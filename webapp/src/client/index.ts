// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {ClientError} from 'mattermost-redux/client/client4';

import manifest from '../manifest';

export default class Client {
    private url: string;

    constructor() {
        this.url = '/plugins/' + manifest.id + '/api/v1';
    }

    async flip(gID: string, index: string): Promise<string> {
        try {
            const res = await this.doPost(`${this.url}/game/${gID}/flip`, {index});
            return res.value as string;
        } catch {
            return '';
        }
    }

    async startGame(channelID: string): Promise<{gID: string, turn: boolean}> {
        try {
            const res = await this.doPost(`${this.url}/start`, {channelID});
            return res as {gID: string, turn: boolean};
        } catch {
            return {gID: '', turn: false};
        }
    }

    async getGame(gID: string): Promise<{cards: string[], turn: boolean, lastFlipped: number, opponentName: string, myScore: number, opponentScore: number}> {
        try {
            const res = await this.doGet(`${this.url}/game/${gID}`);
            return res as {cards: string[], turn: boolean, lastFlipped: number, opponentName: string, myScore: number, opponentScore: number};
        } catch {
            return {cards: [], turn: false, lastFlipped: -1, opponentName: '', myScore: 0, opponentScore: 0};
        }
    }

    async ping(gID: string): Promise<void> {
        try {
            const res = await this.doGet(`${this.url}/game/${gID}/ping`);
        } catch {
            // Do nothing
        }
    }

    private doGet = async (url: string, headers: {[x:string]: string} = {}) => {
        headers['X-Timezone-Offset'] = String(new Date().getTimezoneOffset());

        const options = {
            method: 'get',
            headers,
        };

        const response = await fetch(url, Client4.getOptions(options));

        if (response.ok) {
            return response.json();
        }

        const text = await response.text();

        throw new ClientError(Client4.url, {
            message: text || '',
            status_code: response.status,
            url,
        });
    }

    private doPost = async (url: string, body: any, headers: {[x:string]: string} = {}) => {
        headers['X-Timezone-Offset'] = String(new Date().getTimezoneOffset());

        const options = {
            method: 'post',
            body: JSON.stringify(body),
            headers,
        };

        const response = await fetch(url, Client4.getOptions(options));

        if (response.ok) {
            return response.json();
        }

        const text = await response.text();

        throw new ClientError(Client4.url, {
            message: text || '',
            status_code: response.status,
            url,
        });
    }

    private doDelete = async (url: string, headers: {[x:string]: string} = {}) => {
        headers['X-Timezone-Offset'] = String(new Date().getTimezoneOffset());

        const options = {
            method: 'delete',
            headers,
        };

        const response = await fetch(url, Client4.getOptions(options));

        if (response.ok) {
            return response.json();
        }

        const text = await response.text();

        throw new ClientError(Client4.url, {
            message: text || '',
            status_code: response.status,
            url,
        });
    }

    private doPut = async (url: string, body: any, headers: {[x:string]: string} = {}) => {
        headers['X-Timezone-Offset'] = String(new Date().getTimezoneOffset());

        const options = {
            method: 'put',
            body: JSON.stringify(body),
            headers,
        };

        const response = await fetch(url, Client4.getOptions(options));

        if (response.ok) {
            return response.json();
        }

        const text = await response.text();

        throw new ClientError(Client4.url, {
            message: text || '',
            status_code: response.status,
            url,
        });
    }
}
