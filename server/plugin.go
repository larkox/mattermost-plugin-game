package main

import (
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/larkox/mattermost-plugin-badges/badgesmodel"
	pluginapi "github.com/mattermost/mattermost-plugin-api"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/pkg/errors"
)

// Plugin implements the interface expected by the Mattermost server to communicate between the server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin

	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration

	router    *mux.Router
	mm        *pluginapi.Client
	badgesMap map[string]badgesmodel.BadgeID
	BotUserID string
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
	r.Header.Add("Mattermost-Plugin-ID", c.SourcePluginId)
	w.Header().Set("Content-Type", "application/json")

	p.router.ServeHTTP(w, r)
}

// See https://developers.mattermost.com/extend/plugins/server/reference/
func (p *Plugin) NewGame(user1, user2, gID string) (*Game, error) {
	values := append(GetCardPool(), GetCardPool()...)
	users := []string{user1, user2}
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(values), func(i, j int) { values[i], values[j] = values[j], values[i] })
	rand.Shuffle(len(users), func(i, j int) { users[i], users[j] = users[j], users[i] })

	return &Game{
		GID:           gID,
		CardValues:    values,
		CardFlipped:   []bool{false, false, false, false, false, false, false, false, false, false, false, false},
		LastFlipped:   -1,
		CurrentPlayer: users[0],
		OtherPlayer:   users[1],
		Scores:        map[string]int{user1: 0, user2: 0},
	}, nil
}

func (p *Plugin) OnActivate() error {
	botID, err := p.Helpers.EnsureBot(&model.Bot{
		Username:    "memory",
		DisplayName: "Memory Bot",
		Description: "Created by the Memory game plugin.",
	})
	if err != nil {
		return errors.Wrap(err, "failed to ensure memory bot")
	}
	p.BotUserID = botID

	p.mm = pluginapi.NewClient(p.API)
	p.initializeAPI()
	p.EnsureBadges()

	return nil
}
