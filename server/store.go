package main

import "errors"

func (p *Plugin) getGame(gID string) (*Game, error) {
	game := &Game{}
	err := p.mm.KV.Get(gID, &game)
	if err != nil {
		return nil, err
	}
	if game == nil {
		return nil, errors.New("not found")
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

func (p *Plugin) getPlayerStats(userID string) (*PlayerStats, error) {
	stats := &PlayerStats{}
	err := p.mm.KV.Get(userID, &stats)
	if err != nil {
		return nil, err
	}
	if stats == nil {
		return &PlayerStats{}, nil
	}

	return stats, nil
}

func (p *Plugin) setPlayerStats(userID string, stats *PlayerStats) error {
	_, err := p.mm.KV.Set(userID, stats)
	if err != nil {
		return err
	}

	return nil
}
