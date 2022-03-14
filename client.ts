// This is browser code that gets transformed using Parcel/Babel
// Therefore you can now use ES6 style imports

import * as Phaser from "phaser";

import { uuid } from "./helpers";

interface ICoords {
  x: number;
  y: number;
  frame: number;
}

const DEBUG = false; // Render debug physics entities

class GameScene extends Phaser.Scene {
  private HOST = window.location.hostname; // localhost and 127.0.0.1 handled
  private PORT = 8080; // change this if needed

  private VELOCITY = 100;
  private wsClient?: WebSocket;

  private myId = uuid();
  private players: { [id: string]: Phaser.GameObjects.Sprite } = {};

  private leftKey?: Phaser.Input.Keyboard.Key;
  private rightKey?: Phaser.Input.Keyboard.Key;
  private upKey?: Phaser.Input.Keyboard.Key;
  private downKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "GameScene" });
  }

  /**
   * Load the assets required by the scene
   */
  public preload() {
    this.load.tilemapCSV("map", "static/level_map.csv");
    this.load.image("tiles", "static/tiles_16.png");
    this.load.spritesheet("player", "static/spaceman.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  /**
   * Instantiate the private variables required by the scene
   */
  public init() {
    // Initialize the websocket client
    this.wsClient = new WebSocket(`ws://${this.HOST}:${this.PORT}`);
    this.wsClient.onopen = (event) => console.log(event);
    // TODO: multiplayer functionality
    this.wsClient.onmessage = (wsMsgEvent) => {
      const playersCoordinates: { [id: string]: ICoords } = JSON.parse(
        wsMsgEvent.data
      );
      for (const playerId of Object.keys(playersCoordinates)) {
        if (playerId == this.myId) {
          continue;
        }

        const playerCoordinates = playersCoordinates[playerId];
        const { x, y, frame } = playerCoordinates;
        if (!(playerId in this.players)) {
          this.players[playerId] = this.add.sprite(x, y, "player", frame);
          continue;
        }

        // Have already seen this player before, just update
        const player = this.players[playerId];
        if (player.texture.key === "__MISSING") {
          player.destroy();
          this.players[playerId] = this.add.sprite(x, y, "player", frame);
          continue;
        }

        player.setX(x);
        player.setY(y);
        player.setFrame(frame);
      }
    };
  }

  /**
   * Create the game objects required by the scene
   */
  public create() {
    // Create the TileMap and the Layer
    const tileMap = this.add.tilemap("map", 16, 16);
    tileMap.addTilesetImage("tiles");
    const layer = tileMap.createDynamicLayer("layer", "tiles", 0, 0);
    tileMap.setCollisionBetween(54, 83);
    if (DEBUG) {
      layer.renderDebug(this.add.graphics(), {});
    }

    // Player animations
    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers("player", { start: 8, end: 9 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("player", { start: 1, end: 2 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "up",
      frames: this.anims.generateFrameNumbers("player", { start: 11, end: 13 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "down",
      frames: this.anims.generateFrameNumbers("player", { start: 4, end: 6 }),
      frameRate: 10,
      repeat: -1,
    });

    // Player game object
    this.players[this.myId] = this.physics.add.sprite(48, 48, "player", 1);
    this.physics.add.collider(this.players[this.myId], layer);
    this.cameras.main.startFollow(this.players[this.myId]);
    this.cameras.main.setBounds(
      0,
      0,
      tileMap.widthInPixels,
      tileMap.heightInPixels
    );

    // Keyboard input bindings
    this.leftKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.LEFT
    );
    this.rightKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.RIGHT
    );
    this.upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.DOWN
    );
  }

  public update() {
    const myPlayer = this.players[this.myId];
    if (myPlayer) {
      let moving = false;
      if (this.leftKey && this.leftKey.isDown) {
        (myPlayer.body as Phaser.Physics.Arcade.Body).setVelocityX(
          -this.VELOCITY
        );
        myPlayer.play("left", true);
        moving = true;
      } else if (this.rightKey && this.rightKey.isDown) {
        (myPlayer.body as Phaser.Physics.Arcade.Body).setVelocityX(
          this.VELOCITY
        );
        myPlayer.play("right", true);
        moving = true;
      } else {
        (myPlayer.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      }
      if (this.upKey && this.upKey.isDown) {
        (myPlayer.body as Phaser.Physics.Arcade.Body).setVelocityY(
          -this.VELOCITY
        );
        myPlayer.play("up", true);
        moving = true;
      } else if (this.downKey && this.downKey.isDown) {
        (myPlayer.body as Phaser.Physics.Arcade.Body).setVelocityY(
          this.VELOCITY
        );
        myPlayer.play("down", true);
        moving = true;
      } else {
        (myPlayer.body as Phaser.Physics.Arcade.Body).setVelocityY(0);
      }
      if (!moving) {
        (myPlayer.body as Phaser.Physics.Arcade.Body).setVelocity(0);
        myPlayer.anims.stop();
      } else if (this.wsClient) {
        // Send current player location to server
        this.wsClient.send(
          JSON.stringify({
            id: this.myId,
            x: myPlayer.x,
            y: myPlayer.y,
            frame: myPlayer.frame.name,
          })
        );
      }
      myPlayer.update();
    }
  }
}

// Phaser configuration variables
const config: GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 500,
  scene: [GameScene],
  input: { keyboard: true },
  physics: {
    default: "arcade",
    arcade: { debug: DEBUG },
  },
  render: { pixelArt: true, antialias: false },
};

class LabDemoGame extends Phaser.Game {
  constructor(config: GameConfig) {
    super(config);
  }
}

window.addEventListener("load", () => {
  new LabDemoGame(config);
});
