import "./style.css";

import Phaser from "phaser";

export class Main extends Phaser.Scene {
  moving = false;
  balls!: Phaser.GameObjects.Group;
  cue!: Phaser.GameObjects.Sprite;
  hitLine!: Phaser.GameObjects.Line;
  hitBall!: Phaser.GameObjects.Sprite;

  preload() {
    this.load.aseprite("ball");
    this.load.aseprite("cue");
    this.load.aseprite("rack");

    this.load.image("tiles", "table.png");
    this.load.tilemapTiledJSON("map", "table.tmj");
  }

  create() {
    const map = this.make.tilemap({ key: "map" });
    const tiles = map.addTilesetImage("table", "tiles")!;
    const layer = map.createLayer(0, tiles, 0, 0)!;
    layer.setCollisionFromCollisionGroup();
    this.matter.world.convertTilemapLayer(layer);
    const objectLayer = map.getObjectLayer("Object Layer 1")!;

    for (const object of objectLayer.objects) {
      const pocket = this.add.rectangle(
        object.x! + object.width! / 2,
        object.y! + object.height! / 2,
        object.width!,
        object.height!
      );
      this.matter.add.gameObject(pocket, {
        isStatic: true,
      });
      pocket.on(
        "collide",
        (_self: MatterJS.BodyType, other: MatterJS.BodyType) => {
          if (other.gameObject === cueBall) {
            this.matter.setVelocity(cueBallBody, 0, 0);
            cueBall.x = cueX;
            cueBall.y = cueY;
          } else {
            other.gameObject.destroy();
          }
        }
      );
    }

    this.balls = this.add.group();
    const radius = 9;
    let n = 1;

    for (let i = 0; i < 5; i++) {
      let x = 450 + i * radius * 2;
      let y = 190 - i * radius;

      for (let j = 0; j <= i; j++) {
        const ball = this.add.sprite(x, y, "ball");
        ball.tint = n === 5 ? 0x202033 : n % 2 === 0 ? 0x249fde : 0xffd541;
        ball.postFX.addShadow(0.5, 1, 0.1, 1, 0x000000, 2, 1.25);
        const ballBody = this.matter.add.circle(x, y, radius, {
          restitution: 1,
          friction: 0,
          frictionAir: 0.02,
          frictionStatic: 0,
          inertia: Infinity,
        } as any);
        this.matter.add.gameObject(ball, ballBody);
        this.balls.add(ball);
        y += radius * 2;
        n++;
      }
    }

    const cueX = 240;
    const cueY = 190;
    const cueBall = this.add.sprite(cueX, cueY, "ball");
    cueBall.postFX.addShadow(0.5, 1, 0.1, 1, 0x000000, 2, 1.25);
    const cueBallBody = this.matter.add.circle(cueBall.x, cueBall.y, radius, {
      restitution: 1,
      friction: 0,
      frictionAir: 0.02,
      frictionStatic: 0,
      inertia: Infinity,
    } as any);
    this.matter.add.gameObject(cueBall, cueBallBody);
    this.balls.add(cueBall);

    const cueOffset = 20;
    this.cue = this.add.sprite(cueBall.x - cueOffset, cueBall.y, "cue");
    this.cue.setOrigin(1, 0.5);
    this.cue.postFX.addShadow(0.5, 1, 0.1, 1, 0x000000, 2, 1.25);
    this.hitLine = this.add.line(0, 0, 0, 0, 0, 0, 0xffffff, 0.5);
    this.hitBall = this.add.sprite(cueBall.x, cueBall.y, "ball");
    this.hitBall.alpha = 0.5;

    this.cameras.main.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);

    const rack = this.add.sprite(map.widthInPixels / 2, -100, "rack");
    rack.setInteractive({ cursor: "pointer" });
    rack.on("pointerover", () => {
      rack.scale = 1.1;
    });
    rack.on("pointerout", () => {
      rack.scale = 1;
    });
    rack.on("pointerup", () => {
      this.scene.restart();
    });

    let pointerDown = false;
    let pointerLine = new Phaser.Geom.Line();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.moving) return;

      pointerDown = true;
      pointerLine.x1 = pointer.worldX;
      pointerLine.y1 = pointer.worldY;
      pointerLine.x2 = pointer.worldX;
      pointerLine.y2 = pointer.worldY;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.moving) return;

      pointerLine.x2 = pointer.worldX;
      pointerLine.y2 = pointer.worldY;

      if (pointerDown) {
        const angle = Phaser.Geom.Line.Angle(this.hitLine.geom);
        const speed = Phaser.Geom.Line.Length(pointerLine);

        this.cue.x = cueBall.x - (cueOffset + speed) * Math.cos(angle);
        this.cue.y = cueBall.y - (cueOffset + speed) * Math.sin(angle);
        this.cue.angle = Phaser.Math.RadToDeg(angle);
      } else {
        this.cue.visible = true;
        this.hitLine.visible = true;
        this.hitBall.visible = true;

        const angle = Phaser.Math.Angle.Between(
          cueBall.x,
          cueBall.y,
          pointer.worldX,
          pointer.worldY
        );

        this.cue.x = cueBall.x - cueOffset * Math.cos(angle);
        this.cue.y = cueBall.y - cueOffset * Math.sin(angle);
        this.cue.angle = Phaser.Math.RadToDeg(angle);

        this.hitLine.geom.x1 = cueBall.x;
        this.hitLine.geom.y1 = cueBall.y;
        this.hitLine.geom.x2 = cueBall.x + Math.cos(angle) * 1000;
        this.hitLine.geom.y2 = cueBall.y + Math.sin(angle) * 1000;

        let closestBall: Phaser.GameObjects.Sprite | null = null;
        let shortestCueBallDistance = Infinity;
        let shortestHitLineDistance = Infinity;

        for (const child of this.balls.getChildren()) {
          if (child === cueBall) continue;

          const ball = child as Phaser.GameObjects.Sprite;
          const ballBody = ball.body as MatterJS.BodyType;

          const nearestPoint = Phaser.Geom.Line.GetNearestPoint(
            this.hitLine.geom,
            ballBody.position
          );

          const hitLineDistance = Phaser.Math.Distance.BetweenPoints(
            nearestPoint,
            ballBody.position
          );

          const isOnLineSegment = Phaser.Geom.Intersects.PointToLineSegment(
            nearestPoint,
            this.hitLine.geom
          );

          const cueBallDistance = Phaser.Math.Distance.BetweenPoints(
            ballBody.position,
            cueBallBody.position
          );

          if (
            hitLineDistance < radius * 2 &&
            isOnLineSegment &&
            cueBallDistance < shortestCueBallDistance
          ) {
            closestBall = ball;
            shortestCueBallDistance = cueBallDistance;
            shortestHitLineDistance = hitLineDistance;
          }
        }

        this.hitBall.visible = !!closestBall;

        if (closestBall) {
          let a = Math.sqrt(
            Math.pow(shortestCueBallDistance, 2) -
              Math.pow(shortestHitLineDistance, 2)
          );
          const ab = Math.sqrt(
            Math.pow(radius * 2, 2) - Math.pow(shortestHitLineDistance, 2)
          );
          const b = a - ab;

          const x = cueBall.x + Math.cos(angle) * b;
          const y = cueBall.y + Math.sin(angle) * b;

          this.hitBall.x = x;
          this.hitBall.y = y;

          this.hitLine.geom.x2 = x;
          this.hitLine.geom.y2 = y;
        }
      }
    });

    this.input.on("pointerup", () => {
      if (pointerDown) {
        pointerDown = false;
        this.moving = true;
        this.cue.visible = false;
        this.hitLine.visible = false;
        this.hitBall.visible = false;

        const angle = Phaser.Geom.Line.Angle(this.hitLine.geom);
        const speed = Phaser.Geom.Line.Length(pointerLine) * 0.1;

        this.matter.setVelocity(
          cueBallBody,
          speed * Math.cos(angle),
          speed * Math.sin(angle)
        );
      }
    });
  }

  update() {
    this.moving = false;
    for (const child of this.balls.getChildren()) {
      const ballBody = child.body as MatterJS.BodyType;
      if (ballBody.speed > 0.1) {
        this.moving = true;
        break;
      }
    }
  }
}

new Phaser.Game({
  scene: [Main],
  scale: {
    mode: Phaser.Scale.FIT,
  },
  autoCenter: Phaser.Scale.CENTER_BOTH,
  pixelArt: true,
  transparent: true,
  physics: {
    default: "matter",
    matter: {
      gravity: { y: 0 },
      restingThresh: 0.1,
    },
  },
});
