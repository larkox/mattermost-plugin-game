import React from 'react';
import {Store} from 'redux';

import {GlobalState} from 'mattermost-redux/types/store';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

// eslint-disable-next-line import/no-unresolved
import {GenericAction} from 'mattermost-redux/types/actions';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {PluginRegistry} from 'types/mattermost-webapp';

import RHS from 'components/rhs';
import ChannelHeaderButton from 'components/channel_header_button';
import Client from 'client';
import EventDispatcher from 'phaser/event_emitter';

import manifest from './manifest';

export default class Plugin {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    public async initialize(registry: PluginRegistry, store: Store<GlobalState, GenericAction>) {
        // @see https://developers.mattermost.com/extend/plugins/webapp/reference/
        const {toggleRHSPlugin} = registry.registerRightHandSidebarComponent(RHS, 'Memory Game');

        registry.registerWebSocketEventHandler(`custom_${manifest.id}_flip`, (msg:any) => {
            if (!msg.data) {
                return;
            }

            const ee = EventDispatcher.getInstance();
            ee.emit('remote_flip', msg.data);
        });
        registry.registerWebSocketEventHandler(`custom_${manifest.id}_resync`, (msg:any) => {
            if (!msg.data) {
                return;
            }

            const ee = EventDispatcher.getInstance();
            ee.emit('resync', msg.data);
        });

        const openRHS = () => {
            const channelID = getCurrentChannelId(store.getState());
            const client = new Client();
            client.getGame(channelID).then(({cards}) => {
                if (cards.length === 0) {
                    client.startGame(channelID).then(() => {
                        store.dispatch(toggleRHSPlugin);
                    });
                    return;
                }
                store.dispatch(toggleRHSPlugin);
            });
        };

        registry.registerChannelHeaderButtonAction(
            <ChannelHeaderButton/>,
            openRHS,
            'Memory Game',
            'Start a memory game here.',
        );

        if (registry.registerAppBarComponent) {
            const siteUrl = getConfig(store.getState())?.SiteURL || '';
            const iconURL = `${siteUrl}/plugins/${manifest.id}/public/app-bar-icon.png`;
            registry.registerAppBarComponent(
                iconURL,
                openRHS,
                'Start a memory game here.',
            );
        }
    }
}

declare global {
    interface Window {
        registerPlugin(id: string, plugin: Plugin): void
    }
}

window.registerPlugin(manifest.id, new Plugin());
