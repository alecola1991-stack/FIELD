import { BOT_LEVELS, WORLD } from '../config/settings.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export class BotAI {
  constructor(difficulty = 'normal') {
    this.difficulty = difficulty in BOT_LEVELS ? difficulty : 'normal';
    this.thinkTimer = 0;
    this.targetX = WORLD.width * .82;
    this.targetY = WORLD.height / 2;
    this.shotsTaken = 0;
    this.mode = 'defend';
    this.teamStars = 3;
  }

  setDifficulty(level) {
    this.difficulty = level in BOT_LEVELS ? level : 'normal';
  }

  setTeamStrength(stars) { this.teamStars = clamp(Math.round(Number(stars) || 3), 1, 5); }

  update(bot, ball, player, dt) {
    const world = ball.world || WORLD;
    const config = BOT_LEVELS[this.difficulty];
    const strength = (this.teamStars - 3) / 2;
    this.thinkTimer -= dt;

    if (this.thinkTimer <= 0) {
      this.thinkTimer = config.reaction * (1 - strength * .18);
        const centerX = world.width / 2;
        const centerY = world.height / 2;
      // React to the ball's current position and velocity only. Velocity helps
      // decide whether to defend; the bot never predicts a future ball position.
      const threat = ball.x > 620 - strength * 28 || (ball.x > 485 - strength * 24 && ball.vx > 115 - strength * 12);
      const playerHasBall = Math.hypot(player.x - ball.x, player.y - ball.y)
        < player.radius + ball.radius + 18;

      if (threat) {
        this.mode = 'defend';
        const keeperX = world.width * (.78 + config.defense * .055);
        const keeperY = centerY + (ball.y - centerY) * (.35 + config.defense * .34);
        this.targetX = keeperX;
        this.targetY = clamp(keeperY, world.goalTop + 32, world.goalBottom - 32);

        // Step out to challenge when the ball is deep or the human has control.
        if (ball.x > world.width * (.78 - strength * .035) || (playerHasBall && ball.x > centerX + 25 - strength * 35)) {
          this.targetX = clamp(ball.x + bot.radius + 11, world.left + bot.radius, world.right - bot.radius);
          this.targetY = clamp(ball.y, world.goalTop + 25, world.goalBottom - 25);
        }
        // If the play is wide, guard the lane between the ball and the goal.
        if (ball.x < world.width * .68) {
          this.targetX = Math.max(this.targetX, world.width * .8);
        }
        this.targetX = clamp(this.targetX, world.left + bot.radius, world.right - bot.radius);
      } else {
        this.mode = 'attack';
        const accuracy = clamp(config.accuracy + strength * .09, .25, .96);
        const miss = Math.sin((this.shotsTaken + 1) * 2.399) * (1 - accuracy) * 125;
        const aimY = clamp(world.height / 2 + miss, world.goalTop + 18, world.goalBottom - 18);
        const goalX = world.left - 4;
        const fromGoalX = ball.x - goalX;
        const fromGoalY = ball.y - aimY;
        const length = Math.hypot(fromGoalX, fromGoalY) || 1;
        const offset = bot.radius + 16;
        // Move behind the ball along the line toward the opponent's goal.
        this.targetX = clamp(ball.x + fromGoalX / length * offset, world.left + bot.radius, world.right - bot.radius);
        this.targetY = clamp(ball.y + fromGoalY / length * offset, world.top + bot.radius, world.bottom - bot.radius);
      }
    }

    const toX = this.targetX - bot.x, toY = this.targetY - bot.y;
    const distance = Math.hypot(toX, toY);
    const moveX = distance > 10 ? toX / distance : 0;
    const moveY = distance > 10 ? toY / distance : 0;
    const ballDistance = Math.hypot(ball.x - bot.x, ball.y - bot.y);
    const accuracy = clamp(config.accuracy + strength * .09, .25, .96);
    const strikeReach = bot.radius + ball.radius + 12 + (1 - accuracy) * 15 + (this.teamStars - 3) * 2;
    const kick = ballDistance <= strikeReach && bot.shotCooldown <= 0;

    let kickDirection = null;
    if (kick) {
      const miss = Math.sin((this.shotsTaken + 1) * 2.399) * (1 - accuracy) * 125;
      const aimY = clamp(world.height / 2 + miss, world.goalTop + 18, world.goalBottom - 18);
      kickDirection = { x: world.left - 4 - ball.x, y: aimY - ball.y };
      this.shotsTaken++;
    }

    return {
      x: moveX,
      y: moveY,
      speedMultiplier: config.speed * (bot.speedScale || 1) / bot.maxSpeed * (1 + strength * .09),
      kick,
      kickDirection,
      behavior: this.mode,
    };
  }
}
