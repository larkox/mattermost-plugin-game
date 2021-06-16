/* eslint-disable no-unused-expressions */
import Phaser from 'phaser';

import Client from 'client';

import {canvasHeight, canvasWidth, cardHeight, cardScale, cardWidth, flipZoom, margin, ox, oy} from '../contants';

import {getAssetsURL} from 'utils';

import EventDispatcher from './event_emitter';

export class Scene1 extends Phaser.Scene {
    constructor(config: string | Phaser.Types.Scenes.SettingsConfig, gID: string) {
        super(config);
        this.gID = gID;
    }

    private cardsGroup: Phaser.GameObjects.Sprite[] = []
    private myScore = 0;
    private opponentScore = 0;
    private scoreText?: Phaser.GameObjects.Text;
    private turnText?: Phaser.GameObjects.Text;
    private ping?: Phaser.GameObjects.Container;
    private flipping = false;
    private finished = false;

    private myTurn = true;
    private firstFlipped = '';
    private firstFlippedIndex = -1;

    private loading = true;
    private gID;

    private opponentUsername = '';

    preload() {
        this.load.setBaseURL(getAssetsURL());
        this.load.atlas('cards', '/cards.png', '/cards.json');
    }

    create() {
        let index = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 4; j++) {
                this.cardsGroup.push(this.createCard(i, j, index));
                index++;
            }
        }

        this.add.text(canvasWidth / 2, 50, 'MEMORY', {fontSize: '30px', align: 'center'}).setOrigin(0.5);
        this.turnText = this.add.text(canvasWidth / 2, canvasHeight - 30, '', {fontSize: '15px', align: 'center', wordWrap: {width: canvasWidth - margin}}).setOrigin(0.5);
        this.scoreText = this.add.text(canvasWidth / 2, canvasHeight - 60, `Your score: ${this.myScore}\n@${this.opponentUsername}'s score: ${this.opponentScore}`, {fontSize: '15px', align: 'center'}).setOrigin(0.5);
        this.ping = this.pingButton();

        const client = new Client();
        client.getGame(this.gID).then(({cards, turn, lastFlipped, opponentName, myScore, opponentScore}) => {
            if (cards.length === 0) {
                this.scoreText?.setText('');
                this.turnText?.setText('Cannot get nor create a game for this channel. Try a DM.');
                return;
            }
            this.opponentUsername = opponentName;
            this.resync(cards, turn, lastFlipped, myScore, opponentScore);
            this.loading = false;
        });

        const ee = EventDispatcher.getInstance();
        ee.on('remote_flip', ({index: cardIndex, value, gID}: any) => {
            if (gID !== this.gID) {
                return;
            }
            if (this.finished) {
                return;
            }
            this.flip(this.cardsGroup[cardIndex], value, this.onRemoteFlipComplete);
        });
        ee.on('resync', ({cards, turn, lastFlipped, gID, myScore, opponentScore}: {cards: string[], turn: boolean, lastFlipped: number, myScore: number, opponentScore: number, gID: string}) => {
            if (this.gID !== gID) {
                return;
            }
            if (this.finished) {
                return;
            }
            this.resync(cards, turn, lastFlipped, myScore, opponentScore);
        });

        this.events.on('destroy', () => {
            ee.removeAllListeners();
        });
    }

    private createCard = (i: number, j: number, index: number) => {
        const x = ox + ((cardWidth + margin) * i);
        const y = oy + ((cardHeight + margin) * j);
        const card = this.add.sprite(x, y, 'cards', 0).setInteractive().setScale(cardScale);
        card.setData('index', index);
        card.on('pointerup', () => {
            if (this.loading) {
                return;
            }

            if (this.flipping) {
                return;
            }

            if (!this.myTurn) {
                return;
            }

            if (this.finished) {
                return;
            }

            const flipped: boolean = card.getData('flipped');
            if (flipped) {
                return;
            }

            const cardIndex = card.getData('index');
            const client = new Client();
            this.loading = true;
            client.flip(this.gID, cardIndex).then((value) => {
                this.flip(card, value, this.onUserFlipComplete);
                this.loading = false;
            });
        });

        return card;
    }

    private pingButton = () => {
        const frame = this.add.rectangle(0, 0, canvasWidth / 4, 20, 0x000000, 0xffffff).setStrokeStyle(4, 0xffffff);
        frame.isStroked = true;
        const text = this.add.text(0, 0, 'PING', {fontSize: '15px', align: 'center'}).setOrigin(0.5);

        const container = this.add.container(((canvasWidth * 7) / 8) - 20, 20, [frame, text]).
            setInteractive(new Phaser.Geom.Rectangle(-canvasWidth / 8, -10, canvasWidth / 4, 20), Phaser.Geom.Rectangle.Contains).
            on('pointerover', () => {
                text.setTint(0x44ff44);
                frame.setStrokeStyle(4, 0x44ff44);
            }).on('pointerout', () => {
                text.clearTint();
                frame.setStrokeStyle(4, 0xffffff);
            }).on('pointerup', () => {
                const client = new Client();
                client.ping(this.gID);
            });

        const enablePingButton = () => {
            container.setVisible(true);
            this.add.tween({
                targets: text,
                duration: 200,
                props: {
                    fillAlpha: 1,
                },
                onComplete: () => {
                    container.setActive(true);
                },
            });
            this.add.tween({
                targets: frame,
                duration: 200,
                props: {
                    strokeAlpha: 1,
                },
            });
        };
        const disablePingButton = () => {
            container.setActive(false);
            this.add.tween({
                targets: text,
                duration: 200,
                props: {
                    fillAlpha: 0,
                },
                onComplete: () => {
                    container.setVisible(false);
                },
            });
            this.add.tween({
                targets: frame,
                duration: 200,
                props: {
                    strokeAlpha: 0,
                },
            });
        };

        container.setData('enable', enablePingButton);
        container.setData('disable', disablePingButton);
        this.disablePingButton();
        return container;
    }

    private enablePingButton = () => {
        this.ping?.getData('enable')();
    }

    private disablePingButton = () => {
        this.ping?.getData('disable')();
    }

    private onUserFlipComplete = (gameObject: Phaser.GameObjects.GameObject) => {
        const currentCard = gameObject as Phaser.GameObjects.Sprite;

        if (this.firstFlipped === '') {
            this.firstFlipped = currentCard.frame.name;
            this.firstFlippedIndex = currentCard.getData('index');
            return;
        }

        if (this.firstFlipped === currentCard.frame.name) {
            this.myScore += 1;
            this.firstFlipped = '';
            this.firstFlippedIndex = -1;
            this.scoreText?.setText(`Your score: ${this.myScore}\n@${this.opponentUsername}'s score: ${this.opponentScore}`);
            let finished = true;
            for (let i = 0; i < this.cardsGroup.length; i++) {
                const card = this.cardsGroup[i];
                const flipped = card.getData('flipped');
                if (!flipped) {
                    finished = false;
                    break;
                }
            }

            if (finished) {
                this.finished = true;
                this.turnText?.setText('The game has ended');
                this.disablePingButton();
            }
            return;
        }

        const firstFlippedCard = this.cardsGroup[this.firstFlippedIndex];
        this.flip(currentCard, 0);
        this.flip(firstFlippedCard, 0);
        this.firstFlipped = '';
        this.firstFlippedIndex = -1;
        this.myTurn = false;
        this.turnText?.setText(`It is @${this.opponentUsername}'s turn`);
        this.enablePingButton();
    }

    private onRemoteFlipComplete = (gameObject: Phaser.GameObjects.GameObject) => {
        const currentCard = gameObject as Phaser.GameObjects.Sprite;

        if (this.firstFlipped === '') {
            this.firstFlipped = currentCard.frame.name;
            this.firstFlippedIndex = currentCard.getData('index');
            return;
        }

        if (this.firstFlipped === currentCard.frame.name) {
            this.opponentScore += 1;
            this.firstFlipped = '';
            this.firstFlippedIndex = -1;
            this.scoreText?.setText(`Your score: ${this.myScore}\n@${this.opponentUsername}'s score: ${this.opponentScore}`);

            let finished = true;
            for (let i = 0; i < this.cardsGroup.length; i++) {
                const card = this.cardsGroup[i];
                const flipped = card.getData('flipped');
                if (!flipped) {
                    finished = false;
                    break;
                }
            }

            if (finished) {
                this.disablePingButton();
                this.finished = true;
                this.turnText?.setText('The game has ended');
            }
            return;
        }

        const firstFlippedCard = this.cardsGroup[this.firstFlippedIndex];
        this.flip(currentCard, 0);
        this.flip(firstFlippedCard, 0);
        this.firstFlipped = '';
        this.firstFlippedIndex = -1;
        this.myTurn = true;
        this.turnText?.setText('It is your turn');
        this.disablePingButton();
    }

    resync(cards: string[], turn: boolean, firstFlippedIndex: number, myScore: number, opponentScore: number) {
        this.firstFlippedIndex = firstFlippedIndex;
        if (firstFlippedIndex === -1) {
            this.firstFlipped = '';
        } else {
            this.firstFlipped = cards[firstFlippedIndex];
        }

        this.myScore = myScore;
        this.opponentScore = opponentScore;
        this.scoreText?.setText(`Your score: ${this.myScore}\n@${this.opponentUsername}'s score: ${this.opponentScore}`);

        this.myTurn = turn;
        if (turn) {
            this.turnText?.setText('It is your turn');
            this.disablePingButton();
        } else {
            this.turnText?.setText(`It is @${this.opponentUsername}'s turn`);
            this.enablePingButton();
        }

        for (let i = 0; i < cards.length; i++) {
            const card = this.cardsGroup[i];
            card.setFrame(cards[i]);
            card.setData('flipped', cards[i] !== 'back');
            card.setData('synced', true);
        }
    }

    flip(gameObject: Phaser.GameObjects.GameObject, value: string | number, onFlipComplete?: (gameObject: Phaser.GameObjects.GameObject) => void) {
        this.flipping = true;
        gameObject.setData('synced', false);
        this.add.tween({
            targets: gameObject,
            duration: 200,
            props: {
                scaleX: 0,
                scaleY: flipZoom,
            },
            onComplete: (tween1, targets1) => {
                const card1: Phaser.GameObjects.Sprite = targets1[0];
                if (!card1.getData('synced')) {
                    card1.setFrame(value);
                }
                this.add.tween({
                    targets: targets1,
                    duration: 200,
                    props: {
                        scaleX: cardScale,
                        scaleY: cardScale,
                    },
                    onComplete: (tween2, targets2) => {
                        const card2: Phaser.GameObjects.Sprite = targets2[0];
                        const flipped: boolean = card2.getData('flipped');
                        this.flipping = false;
                        card2.setData('flipped', !flipped);
                        onFlipComplete?.(card2);
                    },
                });
            },
        });
    }
}
