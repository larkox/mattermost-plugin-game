import React from 'react';
import Phaser from 'phaser';

import {Scene1} from 'phaser/scene1';
import {canvasHeight, canvasWidth} from 'contants';

type Props = {
    currentChannelID: string
}
export default class App extends React.Component<Props> {
    private game: Phaser.Game| null
    constructor(props: Props) {
        super(props);

        this.game = null;
    }

    componentDidMount() {
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: canvasWidth,
            height: canvasHeight,
            parent: 'phaser-target',
            scene: this.extended(this.props.currentChannelID),
            backgroundColor: '#4a7957',
            loader: {
                baseURL: '',
            },
        };
        this.game = new Phaser.Game(config);
    }

    componentWillUnmount() {
        if (this.game) {
            this.game.destroy(true);
        }
    }

    render() {
        return (
            <section
                id='phaser-target'
                style={{textAlign: 'center'}}
            />
        );
    }

    extended(gID: string) {
        function newConstructor(config: string | Phaser.Types.Scenes.SettingsConfig) {
            return new Scene1(config, gID);
        }

        newConstructor.prototype = Object.create(Scene1.prototype);
        return newConstructor;
    }
}
