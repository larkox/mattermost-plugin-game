package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/model"
)

// HTTPHandlerFuncWithUser is http.HandleFunc but userID is already exported
type HTTPHandlerFuncWithUser func(w http.ResponseWriter, r *http.Request, userID string)

// ResponseType indicates type of response returned by api
type ResponseType string

const (
	// ResponseTypeJSON indicates that response type is json
	ResponseTypeJSON ResponseType = "JSON_RESPONSE"
	// ResponseTypePlain indicates that response type is text plain
	ResponseTypePlain ResponseType = "TEXT_RESPONSE"
	// ResponseTypeDialog indicates that response type is a dialog response
	ResponseTypeDialog ResponseType = "DIALOG"
)

type APIErrorResponse struct {
	ID         string `json:"id"`
	Message    string `json:"message"`
	StatusCode int    `json:"status_code"`
}

func (p *Plugin) initializeAPI() {
	p.router = mux.NewRouter()
	p.router.Use(p.withRecovery)

	apiRouter := p.router.PathPrefix("/api/v1").Subrouter()

	apiRouter.HandleFunc("/game/{gameID}/flip", p.extractUserMiddleWare(p.handleFlipCard, ResponseTypeJSON)).Methods(http.MethodPost)
	apiRouter.HandleFunc("/game/{gameID}/ping", p.extractUserMiddleWare(p.handlePing, ResponseTypeJSON)).Methods(http.MethodGet)
	apiRouter.HandleFunc("/game/{gameID}", p.extractUserMiddleWare(p.handleGetGame, ResponseTypeJSON)).Methods(http.MethodGet)
	apiRouter.HandleFunc("/start", p.extractUserMiddleWare(p.handleStartGame, ResponseTypeJSON)).Methods(http.MethodPost)

	p.router.PathPrefix("/").HandlerFunc(p.defaultHandler)
}

func (p *Plugin) defaultHandler(w http.ResponseWriter, r *http.Request) {
	p.mm.Log.Debug("Unexpected call", "url", r.URL)
	w.WriteHeader(http.StatusNotFound)
}

func dialogError(w http.ResponseWriter, text string, errors map[string]string) {
	resp := &model.SubmitDialogResponse{
		Error:  "Error: " + text,
		Errors: errors,
	}
	_, _ = w.Write(resp.ToJson())
}

func (p *Plugin) handlePing(w http.ResponseWriter, r *http.Request, actingUserID string) {
	gameID, ok := mux.Vars(r)["gameID"]
	if !ok {
		p.mm.Log.Debug("No gameID")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	game, err := p.getGame(gameID)
	if err != nil {
		p.mm.Log.Debug("cannot get game", "err", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	if game.OtherPlayer != actingUserID {
		p.mm.Log.Debug("Wrong player")
		p.sendResyncWebsocket(actingUserID, game)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	u, err := p.mm.User.Get(actingUserID)
	if err != nil {
		p.mm.Log.Debug("Cannot get user")
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	_ = p.mm.Post.DM(p.BotUserID, game.CurrentPlayer, &model.Post{
		Message: fmt.Sprintf("@%s is waiting for you to move.", u.Username),
	})

	w.WriteHeader(http.StatusOK)
}

func (p *Plugin) handleFlipCard(w http.ResponseWriter, r *http.Request, actingUserID string) {
	gameID, ok := mux.Vars(r)["gameID"]
	if !ok {
		p.mm.Log.Debug("No gameID")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	req := FlipCardRequest{}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		p.mm.Log.Debug("Cannot decode", "err", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	game, err := p.getGame(gameID)
	if err != nil {
		p.mm.Log.Debug("cannot get game", "err", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	if game.CardFlipped[req.Index] {
		p.mm.Log.Debug("Already flipped")
		p.sendResyncWebsocket(actingUserID, game)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	if game.CurrentPlayer != actingUserID {
		p.mm.Log.Debug("Wrong player")
		p.sendResyncWebsocket(actingUserID, game)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	otherPlayerID := game.OtherPlayer

	game.CardFlipped[req.Index] = true
	value := game.CardValues[req.Index]

	if game.LastFlipped == -1 {
		game.LastFlipped = req.Index
	} else {
		lastFlippedValue := game.CardValues[game.LastFlipped]
		if lastFlippedValue == value {
			game.Scores[actingUserID]++
			game.Streak++
		} else {
			game.CardFlipped[game.LastFlipped] = false
			game.CardFlipped[req.Index] = false
			game.CurrentPlayer, game.OtherPlayer = game.OtherPlayer, game.CurrentPlayer
			game.Streak = 0
		}
		game.LastFlipped = -1
	}

	if game.Streak >= 4 {
		p.GrantBadge(AchievementNameStreak, game.CurrentPlayer)
	}

	finished := true
	for _, flipped := range game.CardFlipped {
		if !flipped {
			finished = false
			break
		}
	}

	if finished {
		winner := game.CurrentPlayer
		if game.Scores[game.CurrentPlayer] < game.Scores[game.OtherPlayer] {
			winner = game.OtherPlayer
		}
		var stats *PlayerStats
		stats, err = p.getPlayerStats(winner)
		if err == nil {
			stats.Wins++
			if stats.Wins >= 1 {
				p.GrantBadge(AchievementNameWinOne, winner)
			}
			if stats.Wins >= 5 {
				p.GrantBadge(AchievementNameWinFive, winner)
			}
			if stats.Wins >= 10 {
				p.GrantBadge(AchievementNameWinTen, winner)
			}
			_ = p.setPlayerStats(winner, stats)
		}
		p.GrantBadge(AchievementNamePlayOnce, game.CurrentPlayer)
		p.GrantBadge(AchievementNamePlayOnce, game.OtherPlayer)
		_ = p.removeGame(game)
	} else {
		err = p.setGame(game)
	}

	if err != nil {
		p.mm.Log.Debug("Cannot set game", "err", err)
		p.sendResyncWebsocket(actingUserID, game)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	resp := FlipCardResponse{
		Value: value,
	}

	b, err := json.Marshal(resp)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		p.sendResyncWebsocket(actingUserID, game)
		return
	}

	_, _ = w.Write(b)

	p.mm.Frontend.PublishWebSocketEvent("flip", map[string]interface{}{"index": req.Index, "value": value, "gID": gameID}, &model.WebsocketBroadcast{UserId: otherPlayerID})
}

func (p *Plugin) sendResyncWebsocket(player string, game *Game) {
	values := []string{}
	for i, flipped := range game.CardFlipped {
		toAppend := CardBack
		if flipped {
			toAppend = game.CardValues[i]
		}
		values = append(values, toAppend)
	}

	opponentID := game.CurrentPlayer
	if game.CurrentPlayer == player {
		opponentID = game.OtherPlayer
	}

	p.mm.Frontend.PublishWebSocketEvent("resync", map[string]interface{}{
		"cards":         values,
		"turn":          game.CurrentPlayer == player,
		"lastFlipped":   game.LastFlipped,
		"gID":           game.GID,
		"myScore":       game.Scores[player],
		"opponentScore": game.Scores[opponentID],
	}, &model.WebsocketBroadcast{UserId: player})
}

func (p *Plugin) handleStartGame(w http.ResponseWriter, r *http.Request, actingUserID string) {
	req := StartGameRequest{}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		p.mm.Log.Debug("Cannot decode", "err", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	c, err := p.mm.Channel.Get(req.ChannelID)
	if err != nil {
		p.mm.Log.Debug("Cannot get channel", "err", err)
		return
	}

	if c.Type != model.CHANNEL_DIRECT {
		p.mm.Log.Debug(("Trying to start on non DM"))
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	otherUser := c.GetOtherUserIdForDM(actingUserID)
	game, err := p.NewGame(actingUserID, otherUser, c.Id)
	if err != nil {
		p.mm.Log.Debug("Cannot create", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	err = p.setGame(game)
	if err != nil {
		p.mm.Log.Debug("Cannot set game", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	resp := StartGameResponse{
		GID:  game.GID,
		Turn: game.CurrentPlayer == actingUserID,
	}

	b, err := json.Marshal(resp)
	if err != nil {
		p.mm.Log.Debug("cannot marshal", "err", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	u, err := p.mm.User.Get(actingUserID)
	if err == nil {
		_ = p.mm.Post.DM(p.BotUserID, otherUser, &model.Post{
			Message: fmt.Sprintf("@%s started a memory game with you.", u.Username),
		})
	}

	_, _ = w.Write(b)
}

func (p *Plugin) handleGetGame(w http.ResponseWriter, r *http.Request, actingUserID string) {
	gameID, ok := mux.Vars(r)["gameID"]
	if !ok {
		p.mm.Log.Debug("No game id")
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	game, err := p.getGame(gameID)
	if err != nil {
		p.mm.Log.Debug("cannot get game", "err", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	values := []string{}
	for i, flipped := range game.CardFlipped {
		toAppend := CardBack
		if flipped {
			toAppend = game.CardValues[i]
		}
		values = append(values, toAppend)
	}

	opponentID := game.CurrentPlayer
	if game.CurrentPlayer == actingUserID {
		opponentID = game.OtherPlayer
	}

	opponentName := "unknonw"
	u, err := p.mm.User.Get(opponentID)
	if err == nil {
		opponentName = u.Username
	}

	resp := GetGameResponse{
		Values:        values,
		Turn:          game.CurrentPlayer == actingUserID,
		LastFlipped:   game.LastFlipped,
		OpponentName:  opponentName,
		MyScore:       game.Scores[actingUserID],
		OpponentScore: game.Scores[opponentID],
	}

	b, err := json.Marshal(resp)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	_, _ = w.Write(b)
}

func (p *Plugin) extractUserMiddleWare(handler HTTPHandlerFuncWithUser, responseType ResponseType) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID == "" {
			switch responseType {
			case ResponseTypeJSON:
				p.writeAPIError(w, &APIErrorResponse{ID: "", Message: "Not authorized.", StatusCode: http.StatusUnauthorized})
			case ResponseTypePlain:
				http.Error(w, "Not authorized", http.StatusUnauthorized)
			case ResponseTypeDialog:
				dialogError(w, "Not Authorized", nil)
			default:
				p.mm.Log.Error("Unknown ResponseType detected")
			}
			return
		}

		handler(w, r, userID)
	}
}

func (p *Plugin) withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if x := recover(); x != nil {
				p.mm.Log.Error("Recovered from a panic",
					"url", r.URL.String(),
					"error", x,
					"stack", string(debug.Stack()))
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func (p *Plugin) writeAPIError(w http.ResponseWriter, apiErr *APIErrorResponse) {
	b, err := json.Marshal(apiErr)
	if err != nil {
		p.mm.Log.Warn("Failed to marshal API error", "error", err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	w.WriteHeader(apiErr.StatusCode)

	_, err = w.Write(b)
	if err != nil {
		p.mm.Log.Warn("Failed to write JSON response", "error", err.Error())
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}
