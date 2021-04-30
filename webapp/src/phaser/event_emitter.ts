import Phaser from 'phaser';

let instance: EventDispatcher|null = null;
export default class EventDispatcher extends Phaser.Events.EventEmitter {
    static getInstance() {
        if (instance == null) {
            instance = new EventDispatcher();
        }
        return instance;
    }
}
