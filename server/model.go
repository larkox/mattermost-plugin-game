package main

type FlipCardRequest struct {
	Index int `json:"index"`
}

type FlipCardResponse struct {
	Value string `json:"value"`
}

type StartGameRequest struct {
	ChannelID string `json:"channelID"`
}

type StartGameResponse struct {
	GID  string `json:"gID"`
	Turn bool   `json:"turn"`
}

type GetGameResponse struct {
	Values        []string `json:"cards"`
	Turn          bool     `json:"turn"`
	LastFlipped   int      `json:"lastFlipped"`
	OpponentName  string   `json:"opponentName"`
	MyScore       int      `json:"myScore"`
	OpponentScore int      `json:"opponentScore"`
}

type Game struct {
	GID           string
	CardValues    []string
	CardFlipped   []bool
	LastFlipped   int
	CurrentPlayer string
	OtherPlayer   string
	Scores        map[string]int
	Streak        int
}

type PlayerStats struct {
	Wins int
}

func GetCardPool() []string {
	return []string{
		"heartsAce",
		"diamondsAce",
		"clubsAce",
		"spadesAce",
		"joker",
		"heartsKing",
	}
}
