import Phaser from 'phaser';

import Client from 'client';

import {boardMargin, canvasHeight, canvasWidth, cardHeight, cardScale, cardWidth, flipZoom, margin} from '../contants';

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
    private flipping = false;
    private finished = false;

    private myTurn = true;
    private firstFlipped = '';
    private firstFlippedIndex = -1;

    private loading = true;
    private gID;

    private opponentUsername = '';

    preload() {
        this.load.setBaseURL('http://labs.phaser.io');
        this.load.atlas('cards', 'assets/atlas/cards.png', 'assets/atlas/cards.json');
    }

    create() {
        const ox = boardMargin + (cardWidth / 2);
        const oy = boardMargin + (cardHeight / 2);
        let index = 0;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 4; j++) {
                const x = ox + ((cardWidth + margin) * i);
                const y = oy + ((cardHeight + margin) * j);
                const card = this.add.sprite(x, y, 'cards', 0).setInteractive().setScale(cardScale);
                card.setData('index', index);
                this.cardsGroup.push(card);
                index++;
            }
        }

        this.add.text(canvasWidth / 2, 50, 'MEMORY', {fontSize: '30px', align: 'center'}).setOrigin(0.5);
        this.turnText = this.add.text(canvasWidth / 2, canvasHeight - 30, '', {fontSize: '15px', align: 'center'}).setOrigin(0.5);
        this.scoreText = this.add.text(canvasWidth / 2, canvasHeight - 60, `Your score: ${this.myScore}\n@${this.opponentUsername}'s score: ${this.opponentScore}`, {fontSize: '15px', align: 'center'}).setOrigin(0.5);

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

        this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
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

            const flipped: boolean = gameObject.getData('flipped');
            if (flipped) {
                return;
            }

            const cardIndex = gameObject.getData('index');
            const client = new Client();
            this.loading = true;
            client.flip(this.gID, cardIndex).then((value) => {
                this.flip(gameObject, value, this.onUserFlipComplete);
                this.loading = false;
            });
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
        } else {
            this.turnText?.setText(`It is @${this.opponentUsername}'s turn`);
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

    update() {
        // const player = this.player
        // if (player) {
        //     const cursors = this.input.keyboard.createCursorKeys();
        //     if (cursors.left.isDown)
        //     {
        //         console.log('LEFT')
        //         player.setVelocityX(-160);

        //         player.anims.play('left', true);
        //     }
        //     else if (cursors.right.isDown)
        //     {
        //         console.log('RIGHT')
        //         player.setVelocityX(160);

        //         player.anims.play('right', true);
        //     }
        //     else
        //     {
        //         player.setVelocityX(0);

        //         player.anims.play('turn');
        //     }

        //     if (cursors.up.isDown && player.body.touching.down)
        //     {
        //         console.log('UP!')
        //         player.setVelocityY(-330);
        //     }
        // }
    }
}
