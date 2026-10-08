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
  }

  setDifficulty(level) {
    this.difficulty = level in BOT_LEVELS ? level : 'normal';
  }

  update(bot, ball, player, dt) {
    const config = BOT_LEVELS[this.difficulty];
    this.thinkTimer -= dt;

    if (this.thinkTimer <= 0) {
      this.thinkTimer = config.reaction;
        const centerX = WORLD.width / 2;
        const centerY = WORLD.height / 2;
      // React to the ball's current position and velocity only. Velocity helps
      // decide whether to defend; the bot never predicts a future ball position.
      const threat = ball.x > 620 || (ball.x > 485 && ball.vx > 115);
      const playerHasBall = Math.hypot(player.x - ball.x, player.y - ball.y)
        < player.radius + ball.radius + 18;

      if (threat) {
        this.mode = 'defend';
        const keeperX = WORLD.width * (.78 + config.defense * .055);
        const keeperY = centerY + (ball.y - centerY) * (.35 + config.defense * .34);
        this.targetX = keeperX;
        this.targetY = clamp(keeperY, WORLD.goalTop + 32, WORLD.goalBottom - 32);

        // Step out to challenge when the ball is deep or the human has control.
        if (ball.x > WORLD.width * .78 || (playerHasBall && ball.x > centerX + 25)) {
          this.targetX = clamp(ball.x + bot.radius + 11, WORLD.left + bot.radius, WORLD.right - bot.radius);
          this.targetY = clamp(ball.y, WORLD.goalTop + 25, WORLD.goalBottom - 25);
        }
        // If the play is wide, guard the lane between the ball and the goal.
        if (ball.x < WORLD.width * .68) {
          this.targetX = Math.max(this.targetX, WORLD.width * .8);
        }
        this.targetX = clamp(this.targetX, WORLD.left + bot.radius, WORLD.right - bot.radius);
      } else {
        this.mode = 'attack';
        const miss = Math.sin((this.shotsTaken + 1) * 2.399) * (1 - config.accuracy) * 125;
        const aimY = clamp(WORLD.height / 2 + miss, WORLD.goalTop + 18, WORLD.goalBottom - 18);
        const goalX = WORLD.left - 4;
        const fromGoalX = ball.x - goalX;
        const fromGoalY = ball.y - aimY;
        const length = Math.hypot(fromGoalX, fromGoalY) || 1;
        const offset = bot.radius + 16;
        // Move behind the ball along the line toward the opponent's goal.
        this.targetX = clamp(ball.x + fromGoalX / length * offset, WORLD.left + bot.radius, WORLD.right - bot.radius);
        this.targetY = clamp(ball.y + fromGoalY / length * offset, WORLD.top + bot.radius, WORLD.bottom - bot.radius);
      }
    }

    const toX = this.targetX - bot.x, toY = this.targetY - bot.y;
    const distance = Math.hypot(toX, toY);
    const moveX = distance > 10 ? toX / distance : 0;
    const moveY = distance > 10 ? toY / distance : 0;
    const ballDistance = Math.hypot(ball.x - bot.x, ball.y - bot.y);
    const strikeReach = bot.radius + ball.radius + 12 + (1 - config.accuracy) * 15;
    const kick = ballDistance <= strikeReach && bot.shotCooldown <= 0;

    let kickDirection = null;
    if (kick) {
      const miss = Math.sin((this.shotsTaken + 1) * 2.399) * (1 - config.accuracy) * 125;
      const aimY = clamp(WORLD.height / 2 + miss, WORLD.goalTop + 18, WORLD.goalBottom - 18);
      kickDirection = { x: WORLD.left - 4 - ball.x, y: aimY - ball.y };
      this.shotsTaken++;
    }

    return {
      x: moveX,
      y: moveY,
      speedMultiplier: config.speed / bot.maxSpeed,
      kick,
      kickDirection,
      behavior: this.mode,
    };
  }
}
