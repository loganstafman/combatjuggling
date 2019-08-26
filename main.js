
class Sprite {
    constructor(options) {
        this.ctx = options.context;
        this.width = options.width;
        this.height = options.height;
        this.image = options.image;
        this.number_of_frames = options.number_of_frames || 8;
        this.scaleFactor = 32 / this.width;
    }            
    // render the pct% frame
    render(x, y, pct, scale=1) {
        scale *= this.scaleFactor;
        if ( pct == 1) pct = 0.999;
        const idx = Math.floor(pct * this.number_of_frames);
        this.ctx.drawImage(
            this.image,
            idx * this.width,
            0,
            this.width,
            this.height,
            x - this.width * scale / 2,
            y - this.height * scale / 2,
            this.width * scale,
            this.height * scale
        );
    }
}


class Club {
    static Hand = {
        LEFT: 1,
        RIGHT: 2,
    }
    static ACCEL = -0.022;
    static INIT_THROW_VEL = 1;
    constructor(currHand, pathDist, juggler) {
        // if no currentHand, this is previousHand
        this.currHand = currHand;
        this.currSpins = 1;
        this.pathDist = pathDist;
        this.juggler = juggler;
        this.ctx = juggler.ctx;
        this.isLanding = false;
        this.velocity = Club.INIT_THROW_VEL;
        this.throw_time = this.velocity / Club.ACCEL * -2;
    }

    updateVelocity(v) {
        this.velocity = v;
        this.throw_time = v / Club.ACCEL * -2;
    }
    
    update(dt) {
        const ALLOWABLE_DIST_TO_STAR = 75;

        if (this.pathDist == 0) return;
        this.pathDist += dt / 10 / this.throw_time;
        if (this.pathDist > 0.8) this.isLanding = true;
        // if pathDist > 1, you're caught (or not)!
        if (this.pathDist >= 1) {
            let doesDrop = false;
            if (this.launched) {
                // if the club is launched, check if it was dropped or not
                const probOfDrop = Game.launchRatingOdds(this.juggler.launchRating);
                doesDrop |= Math.random() < probOfDrop;
                // you can be this far from the star to still catch
                const xDiff = Math.abs(this.juggler.location.x - this.launchedPlayerLoc.x);
                const yDiff = Math.abs(this.juggler.location.y - this.launchedPlayerLoc.y);
                const distToStar = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
                doesDrop |= distToStar > ALLOWABLE_DIST_TO_STAR;
                this.juggler.launchRating = null;
            }
            if (doesDrop) {
                //we're dropping the club, animate and end the point
console.log("drop");
            }
            this.pathDist = 0;
            this.isLanding = false;
            this.currHand = (this.currHand == Club.Hand.LEFT) ? Club.Hand.RIGHT : Club.Hand.LEFT;
            this.updateVelocity(Club.INIT_THROW_VEL);
            this.currSpins = 1;
            this.launched = false;
        }
        
    }

    getSpin() {
        return 2 * Math.PI * this.pathDist * this.currSpins;
    }

    calcInAirLoc() {
        const leftToRight = this.currHand == Club.Hand.LEFT;
        let handLocs = this.juggler.getHandLocationsTransformed();
        let direction = this.juggler.direction;
        if (this.launched) {
            handLocs = this.launchedHandLocs;
            direction = this.launchedDirection;
        }
        // gen parabola between two hands, find midpoint based on pathDist
        const height = this.velocity * this.velocity / -1 / Club.ACCEL;
        const vertex = {x : (handLocs.left.x + handLocs.right.x) / 2, y : handLocs.left.y - height };
        const bezier = Bezier.quadraticFromPoints(handLocs.left, vertex, handLocs.right);
        const pt = bezier.compute(leftToRight ? this.pathDist : 1 - this.pathDist);
        return pt;
    }

    draw() {
        let direction = this.juggler.direction;
        if (this.launched) {
            direction = this.launchedDirection;
        }
        const handLocs = this.juggler.getHandLocationsTransformed();
        const handLoc = this.currHand == Club.Hand.LEFT ? handLocs.left : handLocs.right;
        if (this.pathDist == 0) {
            this.drawWithLocAndDir(handLoc.x, handLoc.y, direction);
        } else {
            const loc = this.calcInAirLoc();
            this.drawWithLocAndDir(loc.x,loc.y,direction);
        }
    }
    
    drawLandingStar() {
        const inner_rad = 15;
        const outer_rad = 30;
        this.ctx.strokeStyle='blue';
        this.ctx.fillStyle = 'skyblue';
        this.ctx.lineWidth = 5;
        const c = this.launchedPlayerLoc;
        const step = Math.PI / 5;
        let rot = Math.PI/2 *3;
        let cx = c.x;
        let cy = c.y;
        let pts = [];
        pts.push({ x: c.x, y: c.y - outer_rad });
        for(let i = 0; i < 5; i++) {
            cx = c.x + Math.cos(rot)*outer_rad;
            cy = c.y + Math.sin(rot)*outer_rad;
            pts.push({x: cx, y: cy });
            rot += step;
            cx = c.x + Math.cos(rot)*inner_rad;
            cy = c.y + Math.sin(rot)*inner_rad;
            pts.push({x: cx, y: cy });
            rot += step;
        }
        pts.push({ x: c.x, y: c.y - outer_rad });

        //transform all the points
        for(let i = 0; i < pts.length; i++) {
            pts[i] = this.juggler.game.courtTransformer.transform(pts[i].x, pts[i].y);
            pts[i] = { x: pts[i][0], y: pts[i][1] };
        }
        this.ctx.beginPath();
        this.ctx.moveTo(pts[0].x,pts[0].y);
        for(let i = 1; i < pts.length; i++) {
            this.ctx.lineTo(pts[i].x,pts[i].y);
        }
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
    }

    drawWithLocAndDir(x,y,dir) {
        const leftToRight = this.currHand == Club.Hand.LEFT;
        const sprite = this.juggler.game.clubSprites[dir];
        let loc = this.juggler.location;
        if (this.launched) {
            loc = this.launchedPlayerLoc;
        }
        // const bottomRight = { x: loc.x + sprite.width, y: loc.y + sprite.height };
        // const brTrans = this.juggler.game.courtTransformer.transform(bottomRight.x, bottomRight.y);
        const scale = this.juggler.getScaleFactor(loc.y);
        

        if (dir == Juggler.Direction.DOWN ||
            dir == Juggler.Direction.UP) {
            sprite.render(x,y,leftToRight ? 1 - this.pathDist * this.currSpins % 1 : this.pathDist * this.currSpins % 1, scale);
        } else {
            sprite.render(x,y,this.pathDist * this.currSpins % 1, scale);
        }
    }
}

class Juggler {
    static SPEED = 0.25;
    static Direction = {
        DOWN: 1,
        DOWNLEFT: 2,
        LEFT: 3,
        UPLEFT: 4,
        UP: 5,
        UPRIGHT: 6,
        RIGHT: 7,
        DOWNRIGHT: 8,
    }

    update(dt) {

        // first update x/y location
        if (this.game.isKeyDown("KeyW")) this.location.y -= dt * Juggler.SPEED;
        if (this.game.isKeyDown("KeyA")) this.location.x -= dt * Juggler.SPEED;
        if (this.game.isKeyDown("KeyS")) this.location.y += dt * Juggler.SPEED;
        if (this.game.isKeyDown("KeyD")) this.location.x += dt * Juggler.SPEED;
        this.location.x = Math.max(0, this.location.x);
        this.location.x = Math.min(this.game.width, this.location.x);
        this.location.y = Math.max(0, this.location.y);
        this.location.y = Math.min(this.game.height, this.location.y);

        //also update direction
        if (this.game.isKeyDown("KeyS") && this.game.isKeyDown("KeyA")) this.direction = Juggler.Direction.DOWNLEFT;
        else if (this.game.isKeyDown("KeyS") && this.game.isKeyDown("KeyD")) this.direction = Juggler.Direction.DOWNRIGHT;
        else if (this.game.isKeyDown("KeyW") && this.game.isKeyDown("KeyA")) this.direction = Juggler.Direction.UPLEFT;
        else if (this.game.isKeyDown("KeyW") && this.game.isKeyDown("KeyD")) this.direction = Juggler.Direction.UPRIGHT;
        else if (this.game.isKeyDown("KeyS")) this.direction = Juggler.Direction.DOWN;
        else if (this.game.isKeyDown("KeyA")) this.direction = Juggler.Direction.LEFT;
        else if (this.game.isKeyDown("KeyW")) this.direction = Juggler.Direction.UP;
        else if (this.game.isKeyDown("KeyD")) this.direction = Juggler.Direction.RIGHT;
        
        //now update club locations
        this.leftHand.update(dt);
        this.rightHand.update(dt);
        this.inAir.update(dt);
        if (this.inAir.isLanding) {
            //club is landing in right hand
            if (this.inAir.currHand == Club.Hand.LEFT) {
                const tmp = this.inAir;
                this.inAir = this.rightHand;
                this.rightHand = tmp;
            } else {
                const tmp = this.inAir;
                this.inAir = this.leftHand;
                this.leftHand = tmp;
            }
            this.inAir.pathDist = 0.0001;
            //if this is a launched club, set it up
            if (this.nextLaunch) {
                this.inAir.launched = true;
                this.inAir.launchedDirection = this.direction;
                this.inAir.launchedHandLocs = this.getHandLocationsTransformed(); 
                this.inAir.launchedPlayerLoc = {x: this.location.x, y: this.location.y };
                this.inAir.currSpins = Math.round(this.nextLaunch * 4) + 1;
                this.inAir.updateVelocity(Club.INIT_THROW_VEL + (this.inAir.currSpins) * .35);
                this.nextLaunch = null;
            }
        }
    }

    constructor(game) {
        this.name = this.getName();
        this.location = { x: 200, y: 200 };
        this.ctx = game.ctx;
        this.game = game;
        this.direction = Juggler.Direction.DOWN;
        this.leftHand = new Club(Club.Hand.LEFT, 0, this);
        this.rightHand = new Club(Club.Hand.RIGHT, 0, this);
        // when an inAir club is about to land, set isLanding false and make other inAir
        this.inAir = new Club(Club.Hand.RIGHT, 0.0001, this);
        this.startTime = Date.now();
    }
    // return scaling factor from original y location
    getScaleFactor(y) {
        return 1 - ((this.game.height - y) / this.game.height) * 0.3;
    }
    
    getHandLocationsTransformed() {
        const loc = this.transformLocation();
        const scale = this.getScaleFactor(this.location.y);
        let leftXOff = 0;
        let leftYOff = 0;
        let rightXOff = 0;
        let rightYOff = 0;
        switch(this.direction) {
            case Juggler.Direction.DOWN:
                    leftXOff = -30;
                    leftYOff = -30;
                    rightXOff = 30;
                    rightYOff = -30;
                    break;
            case Juggler.Direction.UP:
                leftXOff = 20;
                leftYOff = -45;
                rightXOff = -20;
                rightYOff = -45;
                break;
            case Juggler.Direction.DOWNRIGHT:
                leftXOff = 10;
                leftYOff = -35;
                rightXOff = 20;
                rightYOff = -30;
                break;

            case Juggler.Direction.UPRIGHT:
                leftXOff = 20;
                leftYOff = -35;
                rightXOff = 10;
                rightYOff = -30;
                break;
            case Juggler.Direction.RIGHT:
                leftXOff = 20;
                leftYOff = -35;
                rightXOff = 20;
                rightYOff = -30;
                break;
            case Juggler.Direction.UPLEFT:
                leftXOff = -20;
                leftYOff = -30;
                rightXOff = -10;
                rightYOff = -35;
                break;
            case Juggler.Direction.DOWNLEFT:
                leftXOff = -10;
                leftYOff = -30;
                rightXOff = -20;
                rightYOff = -35;
                break;
            case Juggler.Direction.LEFT:
                leftXOff = -20;
                leftYOff = -30;
                rightXOff = -20;
                rightYOff = -35;
                break;
        }
        return {
            left: {
                x: loc.x + leftXOff * scale,
                y: loc.y + leftYOff * scale,
            },
            right: {
                x: loc.x + rightXOff * scale,
                y: loc.y + rightYOff * scale,
            },
        };
    }

    transformLocation() {
        const pt = this.game.courtTransformer.transform(this.location.x, this.location.y);
        return { x: pt[0], y: pt[1] };
    }

    drawShadow() {
        const X_RADIUS = 30;
        const Y_RADIUS = 15;
        const OFFSET = 20;
        const tXY = this.game.courtTransformer.transform(this.location.x, this.location.y + OFFSET);
        const tXrYr = this.game.courtTransformer.transform(this.location.x - X_RADIUS, this.location.y + OFFSET - Y_RADIUS);
        this.ctx.fillStyle = "rgba(0,0,0, 0.5)";
        // this.ctx.fillStyle = "black";
        this.ctx.beginPath();
        this.ctx.ellipse(tXY[0], tXY[1], tXY[0] - tXrYr[0], tXY[1] - tXrYr[1], 0, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    drawClubs() {
        this.leftHand.draw();
        this.rightHand.draw();
        this.inAir.draw();
    }

    drawTopHalf() {
        const BODY_FPS = 6;
        const SCALE = 2;
        const loc = this.transformLocation();
        const body = this.game.bodySprites[this.direction];
        const scale = this.getScaleFactor(this.location.y) * SCALE;
        let pct = 0.0;
        // calculate pct based on club location
        if (this.rightHand.pathDist != 0) {
            pct = this.rightHand.pathDist > 0.9 ? 7/8 : 3/4;
        } else if (this.leftHand.pathDist != 0) {
            pct = this.leftHand.pathDist > 0.9 ? 1/8 : 1/4;
        }
        body.render(loc.x, loc.y - 24 * scale, pct, scale);
    }
    
    drawRatingWord() {
        const RATING_WORD_TIME = 1000;
        const HEIGHT = 30;
        if (!this.launchRating) return;
        const diffMS = Date.now() - this.launchRatingTime;
        if (diffMS > RATING_WORD_TIME) {
            return;
        }
        this.ctx.fillStyle = Game.launchRatingWordColor(this.launchRating);
        this.ctx.font = "20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(Game.launchRatingWord(this.launchRating),
                          this.launchRatingLoc.x,
                          this.launchRatingLoc.y - 75 - (diffMS / RATING_WORD_TIME) * HEIGHT);

    }

    drawBottomHalf() {
        const LEGS_FPS = 16;
        const SCALE = 1.25;
        const legs = this.game.legSprites[this.direction];
        const loc = this.transformLocation();
        // scaling logic
        // const bottomRight = { x: this.location.x + legs.width, y: this.location.y + legs.height };
        // const brTrans = this.game.courtTransformer.transform(bottomRight.x, bottomRight.y);
        // const scaleY = Math.abs(brTrans[1] - loc.y) / legs.height * SCALE;
        const scale = this.getScaleFactor(this.location.y) * 1.25; 
        if (this.isMoving) {
            const diffMS = Date.now() - this.startMoving;
            const mspf = 1000 / LEGS_FPS;
            const amt = diffMS / mspf;
            const ah =  amt % legs.number_of_frames;
            legs.render(loc.x, loc.y, ah / legs.number_of_frames, scale);
        } else {
            legs.render(loc.x ,loc.y, 0, scale);
        }
    }

    draw() {
        // first, draw Landing star
        if (this.leftHand.launched) { this.leftHand.drawLandingStar(); }
        if (this.rightHand.launched) { this.rightHand.drawLandingStar(); }
        if (this.inAir.launched) { this.inAir.drawLandingStar(); }
        this.drawShadow();
        if (this.direction == Juggler.Direction.LEFT ||
            this.direction == Juggler.Direction.UPLEFT ||
            this.direction == Juggler.Direction.DOWNLEFT) {
            this.rightHand.draw();
            this.drawBottomHalf();
            this.drawTopHalf();
            this.leftHand.draw();
            this.inAir.draw();
        } else if (this.direction == Juggler.Direction.RIGHT ||
                   this.direction == Juggler.Direction.UPRIGHT ||
                   this.direction == Juggler.Direction.DOWNRIGHT) {
            this.leftHand.draw();
            this.drawBottomHalf();
            this.drawTopHalf();
            this.rightHand.draw();
            this.inAir.draw();
        } else if (this.direction == Juggler.Direction.UP) {
            this.leftHand.draw();
            this.rightHand.draw();
            this.inAir.draw();
            this.drawBottomHalf();
            this.drawTopHalf();
        } else {
            this.drawTopHalf();
            this.drawBottomHalf();
            this.drawClubs();
        }
        this.drawRatingWord();
    }
}

class WesPeden extends Juggler {

    constructor(game) {
        super(game);
    }

    getName() {
        return "Wes Peden";
    }
}


class Game {
    static PlayState = {
        START_SCREEN: 1,
        PLAYING: 2,
    };

    static LaunchRating = {
        PERFECT: 1,
        GREAT: 2,
        GOOD: 3,
        OKAY: 4,
        POOR: 5,
    };

    static launchRatingWord(rating) {
        switch(rating) {
            case Game.LaunchRating.PERFECT:
                return "Perfect!!!";
            case Game.LaunchRating.GREAT:
                return "Great!";
            case Game.LaunchRating.GOOD:
                return "Good";
            case Game.LaunchRating.OKAY:
                return "Okay";
            case Game.LaunchRating.POOR:
                return "Poor";
        }
    }

    static launchRatingWordColor(rating) {
        switch(rating) {
            case Game.LaunchRating.PERFECT:
                return "green";
            case Game.LaunchRating.GREAT:
                return "yellowgreen";
            case Game.LaunchRating.GOOD:
                return "yellow";
            case Game.LaunchRating.OKAY:
                return "orange";
            case Game.LaunchRating.POOR:
                return "red";
        }
    }
    
    // returns prob of dropping
    static launchRatingOdds(rating) {
        switch(rating) {
            case Game.LaunchRating.PERFECT:
            case Game.LaunchRating.GREAT:
                return 0;
            case Game.LaunchRating.GOOD:
                return 0.05;
            case Game.LaunchRating.OKAY:
                return 0.20;
            case Game.LaunchRating.POOR:
                return 0.50;
        }
    }

    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.height = canvas.height;
        this.width = canvas.width;
        this.gameState = Game.PlayState.START_SCREEN;
        this.eventQ = [];
        this.keysDown = [];
        this.clubSprites = [];
        this.legSprites = [];
        this.bodySprites = [];
        // create transformer
        const srcCorners = [0, 0, 0, this.height, this.width, this.height, this.width, 0]; 
        const destCorners = [this.width / 5.0, this.height / 5.0, 0, this.height, this.width, this.height, this.width * 4 / 5.0, this.height / 5.0];
        this.courtTransformer = PerspT(srcCorners, destCorners);

        this.loadSprites();

        // start drawing
        window.requestAnimationFrame(this.step.bind(this));

        // start listening to keyboard
        window.addEventListener('keydown', this.addKeyEvent.bind(this));
        window.addEventListener('keyup', this.addKeyEvent.bind(this));

        this.player = new WesPeden(this);
    }

    loadSprites() {
        //clubs
        this.clubSprites[Juggler.Direction.DOWN] = this.loadSprite("sprites/clubDown.png");
        this.clubSprites[Juggler.Direction.UP] = this.loadSprite("sprites/clubUp.png");
        this.clubSprites[Juggler.Direction.RIGHT] = this.loadSprite("sprites/clubRight.png");
        this.clubSprites[Juggler.Direction.DOWNRIGHT] = this.clubSprites[Juggler.Direction.RIGHT];
        this.clubSprites[Juggler.Direction.UPRIGHT] = this.clubSprites[Juggler.Direction.RIGHT];
        this.clubSprites[Juggler.Direction.LEFT] = this.loadSprite("sprites/clubLeft.png");
        this.clubSprites[Juggler.Direction.DOWNLEFT] = this.clubSprites[Juggler.Direction.LEFT];
        this.clubSprites[Juggler.Direction.UPLEFT] = this.clubSprites[Juggler.Direction.LEFT];
        //legs
        this.legSprites[Juggler.Direction.DOWN] = this.loadSprite("sprites/legsDown.png");
        this.legSprites[Juggler.Direction.UP] = this.legSprites[Juggler.Direction.DOWN];
        this.legSprites[Juggler.Direction.LEFT] = this.loadSprite("sprites/legsLeft.png");
        this.legSprites[Juggler.Direction.RIGHT] = this.loadSprite("sprites/legsRight.png");
        this.legSprites[Juggler.Direction.DOWNRIGHT] = this.legSprites[Juggler.Direction.RIGHT];
        this.legSprites[Juggler.Direction.UPRIGHT] = this.legSprites[Juggler.Direction.RIGHT];
        this.legSprites[Juggler.Direction.DOWNLEFT] = this.legSprites[Juggler.Direction.LEFT];
        this.legSprites[Juggler.Direction.UPLEFT] = this.legSprites[Juggler.Direction.LEFT];
        //body
        this.bodySprites[Juggler.Direction.RIGHT] = this.loadSprite("sprites/bodyRight.png");
        this.bodySprites[Juggler.Direction.UPRIGHT] = this.bodySprites[Juggler.Direction.RIGHT];
        this.bodySprites[Juggler.Direction.DOWNRIGHT] = this.bodySprites[Juggler.Direction.RIGHT];
        this.bodySprites[Juggler.Direction.LEFT] = this.loadSprite("sprites/bodyLeft.png");
        this.bodySprites[Juggler.Direction.UPLEFT] = this.bodySprites[Juggler.Direction.LEFT];
        this.bodySprites[Juggler.Direction.DOWNLEFT] = this.bodySprites[Juggler.Direction.LEFT];
        this.bodySprites[Juggler.Direction.DOWN] = this.loadSprite("sprites/bodyDown.png", 54, 54);
        this.bodySprites[Juggler.Direction.UP] = this.loadSprite("sprites/bodyUp.png", 54, 54);
    }

    loadSprite(uri, w=32, h=32) {
        const clubImage = new Image();
        clubImage.src = uri;
        return new Sprite({
            context: this.ctx,
            width: w,
            height: h,
            number_of_frames: 8,
            image: clubImage,
        });
    }

    addKeyEvent(e) {
        this.eventQ.push(e);
    }

    isKeyDown(keyCode) {
        if (keyCode in this.keysDown) return this.keysDown[keyCode];
        return false;
    }

    drawStartScreen() {
        this.ctx.fillStyle = "black";
        this.ctx.font = "30px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText("Press Spacebar to start", this.width / 2, this.height / 2);
    }
    
    // returns from 0 to 1 the launch value
    // 0.25 = double spin, 0.5 = triple, etc
    getLaunchValue() {
        const MAX_BAR_TIME = 1500;
        const diffMS = Date.now() - this.launchStartTime;
        const mod = diffMS % (MAX_BAR_TIME * 2);
        if (mod > MAX_BAR_TIME) {
            //then you're on the way back
            return (MAX_BAR_TIME*2 - mod) / MAX_BAR_TIME;
        } else {
            return (diffMS % MAX_BAR_TIME)/ MAX_BAR_TIME;
        }
    }

    drawLaunchBar() {
        const LAUNCH_BAR_HEIGHT = 50;
        const BOTTOM_MARGIN = 50;
        const LAUNCH_BAR_WIDTH = 500;
        const MAX_BAR_TIME = 2000;
        //draw border
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = "rgba(0,0,0,1)";
        this.ctx.strokeRect(this.width / 2 - LAUNCH_BAR_WIDTH / 2,
                            this.height - (50 + LAUNCH_BAR_HEIGHT),
                            LAUNCH_BAR_WIDTH,
                            LAUNCH_BAR_HEIGHT);
        //fill background of rect
        this.fillStyle = "gray";
        this.ctx.fillRect(this.width / 2 - LAUNCH_BAR_WIDTH / 2,
                            this.height - (50 + LAUNCH_BAR_HEIGHT),
                            LAUNCH_BAR_WIDTH,
                            LAUNCH_BAR_HEIGHT);
        const gradient = this.ctx.createLinearGradient(0, 0, LAUNCH_BAR_WIDTH, 0);
        gradient.addColorStop(0, "orange");
        gradient.addColorStop(1, "red");
        //fill up to time so far
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(this.width / 2 - LAUNCH_BAR_WIDTH / 2,
                          this.height - (BOTTOM_MARGIN + LAUNCH_BAR_HEIGHT),
                          LAUNCH_BAR_WIDTH * this.getLaunchValue(),
                          LAUNCH_BAR_HEIGHT);
        // draw aiming lines
        for (let i = 1; i < 4; i++) {
            this.ctx.beginPath();
            const x = LAUNCH_BAR_WIDTH * i / 4 + this.width / 2 - LAUNCH_BAR_WIDTH / 2;
            const y = this.height - (BOTTOM_MARGIN + LAUNCH_BAR_HEIGHT);
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x, this.height - BOTTOM_MARGIN);
            this.ctx.closePath();
            this.ctx.stroke();
        }

    }

    drawPlaying() {
        this.drawCourt();
        this.player.draw();
        if (this.isKeyDown("Space")) {
            this.drawLaunchBar();
        } 
    }

    
    drainEventQueue() {
        while (this.eventQ.length > 0) {
            const evt = this.eventQ.shift();
            this.handleEvent(evt);
        }
    }

    handleEvent(e) {
        switch(this.gameState) {
            case Game.PlayState.START_SCREEN:
                this.startScreenHandleEvent(e);
                break;
            case Game.PlayState.PLAYING:
                this.playingHandleEvent(e);
                break;
        }
    }

    startScreenHandleEvent(e) {
        if (e.code == "Space") {
            this.gameState = Game.PlayState.PLAYING;
        }
    }

    playingHandleEvent(e) {
        if (e.code == "KeyW" ||
            e.code == "KeyA" ||
            e.code == "KeyS" ||
            e.code == "KeyD" ||
            e.code == "Space") {
            this.keysDown[e.code] = e.type == "keydown";
        }
        if (e.code == "KeyW" ||
            e.code == "KeyA" ||
            e.code == "KeyS" ||
            e.code == "KeyD") {
            if (e.type == "keydown") {
                if (!this.player.isMoving) {
                    this.player.isMoving = true;
                    this.player.startMoving = Date.now();
                }
            } else if (!this.isKeyDown("KeyW") &&
                       !this.isKeyDown("KeyA") &&
                       !this.isKeyDown("KeyS") &&
                       !this.isKeyDown("KeyD")) {
                this.player.isMoving = false;
            }
        }
        if (e.code == "Space") {
            if (e.type == "keydown") {
                if (!this.launchStartTime) this.launchStartTime = Date.now();
            } else {
                //is a keyup event
                if (this.player) {
                    this.player.nextLaunch = this.getLaunchValue();
                    this.triggerRatingWord(this.player.nextLaunch);
                }
                this.launchStartTime = null;
            }
        }
    }

    triggerRatingWord(launchValue) {
        if(!launchValue) return;
        //launchValue is 0 to 1. If close to 0.25, 0.5, 0.75, or 1.0 it's good
        let x = launchValue % 0.25;
        x = Math.min(x, 0.25 - x);
        const rating = x / 0.125;
        this.player.launchRatingTime = Date.now();
        this.player.launchRatingLoc = this.player.transformLocation();
        if (rating < 0.1) {
            this.player.launchRating = Game.LaunchRating.PERFECT;
        } else if (rating < 0.3) {
            this.player.launchRating = Game.LaunchRating.GREAT;
        } else if (rating < 0.5) {
            this.player.launchRating = Game.LaunchRating.GOOD;
        } else if (rating < 0.75) {
            this.player.launchRating = Game.LaunchRating.OKAY;
        } else {
            this.player.launchRating = Game.LaunchRating.POOR;
        }
    }

    drawCourt() {
        // first draw yellow court
        const topLeft = this.courtTransformer.transform(0, 0);
        const bottomLeft = this.courtTransformer.transform(0, this.height);
        const bottomRight = this.courtTransformer.transform(this.width, this.height);
        const topRight = this.courtTransformer.transform(this.width, 0);
        this.ctx.fillStyle = "rgb(255, 214, 64)";
        this.ctx.beginPath();
        this.ctx.moveTo(topLeft[0], topLeft[1]);
        this.ctx.lineTo(bottomLeft[0], bottomLeft[1]);
        this.ctx.lineTo(bottomRight[0], bottomRight[1]);
        this.ctx.lineTo(topRight[0], topRight[1]);
        this.ctx.lineTo(topLeft[0], topLeft[1]);
        this.ctx.closePath();
        this.ctx.fill();
        // next, draw circle in center and lines
        this.ctx.strokeStyle = "red";
        this.ctx.lineWidth = 5;
        const leftSide = this.courtTransformer.transform(0, this.height / 2);
        const rightSide = this.courtTransformer.transform(this.width, this.height / 2);
        this.ctx.beginPath();
        this.ctx.moveTo(leftSide[0], leftSide[1]);
        this.ctx.lineTo(rightSide[0], rightSide[1]);
        this.ctx.closePath();
        this.ctx.stroke();
        const RADIUS = 100;
        const tXY = this.courtTransformer.transform(this.width / 2, this.height / 2);
        const tXrYr = this.courtTransformer.transform(this.width / 2 - RADIUS, this.height / 2 - RADIUS);
        this.ctx.beginPath();
        this.ctx.ellipse(tXY[0], tXY[1], tXY[0] - tXrYr[0], tXY[1] - tXrYr[1], 0, 0, 2 * Math.PI);
        this.ctx.closePath();
        this.ctx.stroke();
 
    }

    draw(dt) {
        this.ctx.fillStyle = "white";
        this.ctx.fillRect(0,0,this.width,this.height);
        switch (this.gameState) {
            case Game.PlayState.START_SCREEN:
                this.drawStartScreen();
                break;
            case Game.PlayState.PLAYING:
                this.drawPlaying();
                break;
        }
    }

    step(timestamp) {
        if (!this.last) this.last = timestamp;
        const dt = timestamp - this.last;
        this.last = timestamp;
        this.drainEventQueue();
        if (this.gameState == Game.PlayState.PLAYING)
            this.player.update(dt);
        this.draw(dt);
        window.requestAnimationFrame(this.step.bind(this));
    }
}
$(function() {
    const canvas = $("#myCanvas")[0];
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let game = new Game(canvas);
});
