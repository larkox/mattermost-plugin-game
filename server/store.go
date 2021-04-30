package main

import "errors"

func (p *Plugin) getGame(gID string) (*Game, error) {
	game := &Game{}
	err := p.mm.KV.Get(gID, &game)
	if err != nil {
		return nil, err
	}
	if game == nil {
		return nil, errors.New("Not found")
	}
	return game, nil
}

func (p *Plugin) setGame(game *Game) error {
	_, err := p.mm.KV.Set(game.GID, game)
	if err != nil {
		return err
	}

	return nil
}

func (p *Plugin) removeGame(game *Game) error {
	return p.mm.KV.Delete(game.GID)
}
