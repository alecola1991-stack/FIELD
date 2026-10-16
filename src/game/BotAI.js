import { BOT_LEVELS, WORLD } from '../config/settings.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const WALL_RESTITUTION = .78; // matches resolveBallWalls for the touchlines
const BANK_SHOT_RANGE = 460; // longer banks arrive too slow after the rolling friction

export class BotAI {
  constructor(difficulty = 'normal') {
    this.difficulty = difficulty in BOT_LEVELS ? difficulty : 'normal';
    this.thinkTimer = 0;
    this.targetX = WORLD.width * .82;
    this.targetY = WORLD.height / 2;
    this.shotsTaken = 0;
    this.mode = 'defend';
    this.teamStars = 3;
    this.random = Math.random; // replaceable in tests
    this.feint = null; this.feintCooldown = 0; this.feintCheck = 0; this.wallCooldown = 0;
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

      // Skilled levels go and take a loose ball in their own half instead of waiting in goal.
      const looseBall = config.skills && Math.hypot(player.x - ball.x, player.y - ball.y) > 170 && Math.hypot(ball.vx, ball.vy) < 170 && ball.x > player.x;
      if (threat && !looseBall) {
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

    // Profesional and Champions attack with the ball at their feet.
    if (config.skills && this.mode === 'attack') return this.skilledAttack(bot, ball, player, dt, config, strength, world);

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

  // ---- Skilled attack -----------------------------------------------------------
  // Carries the ball close (soft touches instead of shots), shoots only from range
  // or when pressed, feints past a defender that blocks the lane and plays the ball
  // off the side walls: a bank shot near goal or a one-two with the wall further out.
  skilledAttack(bot, ball, player, dt, config, strength, world) {
    const skills = config.skills;
    this.feintCooldown -= dt; this.feintCheck -= dt; this.wallCooldown -= dt;
    const goalX = world.left - 4, goalY = world.height / 2;
    const toGoal = unit(goalX - ball.x, goalY - ball.y);
    const contact = bot.radius + ball.radius;
    const ballDistance = Math.hypot(ball.x - bot.x, ball.y - bot.y);
    const goalDistance = ball.x - world.left;
    const baseSpeed = config.speed * (bot.speedScale || 1) / bot.maxSpeed * (1 + strength * .09);
    // Where the defender (the human) stands relative to the ball and the goal line.
    const relX = player.x - ball.x, relY = player.y - ball.y;
    const along = relX * toGoal.x + relY * toGoal.y;
    const lateral = toGoal.x * relY - toGoal.y * relX;
    const blocking = along > -10 && along < 190 && Math.abs(lateral) < player.radius + ball.radius + 38;
    const pressed = Math.hypot(relX, relY) < player.radius + ball.radius + 34;
    const accuracy = clamp(config.accuracy + strength * .09, .25, .96);
    const strikeReach = bot.radius + ball.radius + 12 + (1 - accuracy) * 15 + (this.teamStars - 3) * 2;
    const canStrike = ballDistance <= strikeReach && bot.shotCooldown <= 0;

    // 1) Shots: from range with a clear lane, off a wall when blocked, or under pressure.
    if (canStrike && !this.feint) {
      if (goalDistance < skills.shootRange && !blocking) return this.strike(this.goalAim(world, accuracy, ball), 'shoot', baseSpeed);
      if (blocking && this.wallCooldown <= 0 && along < 150 && this.random() < skills.wallChance) {
        this.wallCooldown = skills.wallCooldown;
        // Use the wall on the side away from the defender.
        const wallY = player.y >= ball.y ? world.top + ball.radius : world.bottom - ball.radius;
        // Bank shot: aim at the goal mirrored by the wall. The wall returns only
        // WALL_RESTITUTION of the vertical speed, so the mirrored point is stretched.
        const bank = this.bankShot(world, ball, wallY, accuracy);
        if (bank) return this.strike(bank, 'wall', baseSpeed);
        if (goalDistance > 260) {
          // One-two with the wall: play it off the touchline past the defender and run onto it.
          const ahead = clamp(along + 150, 170, 300);
          return this.strike({ x: -ahead, y: wallY - ball.y }, 'wall', baseSpeed);
        }
        this.wallCooldown = 0; // too close and too far for a bank: let the feint try
      }
      if (pressed && goalDistance < skills.shootRange * 1.4) return this.strike(this.goalAim(world, accuracy, ball), 'shoot', baseSpeed);
    }

    // 2) Feint: show one side, then cut to the other.
    if (!this.feint && blocking && along < 150 && ballDistance < contact + 30 && this.feintCooldown <= 0 && this.feintCheck <= 0) {
      this.feintCheck = .35;
      if (this.random() < skills.feintChance) this.feint = { side: lateral >= 0 ? 1 : -1, phase: 'show', timer: skills.feintShow };
    }
    let carry = toGoal, behavior = 'dribble', burst = 1;
    if (this.feint) {
      const feint = this.feint;
      feint.timer -= dt;
      if (feint.phase === 'show' && feint.timer <= 0) { feint.phase = 'cut'; feint.timer = skills.feintCut; }
      else if (feint.phase === 'cut' && feint.timer <= 0) { this.feint = null; this.feintCooldown = skills.feintCooldown; }
      if (this.feint) {
        // "show" leans toward the defender's side; "cut" goes hard the other way.
        carry = rotate(toGoal, feint.phase === 'show' ? feint.side * .9 : -feint.side * 1.05);
        behavior = 'feint'; burst = feint.phase === 'cut' ? 1.35 : .9;
      }
    }
    // Keep the carry away from the touchlines.
    const margin = 46;
    if (ball.y < world.top + margin && carry.y < 0) carry = unit(carry.x, Math.abs(carry.y) * .4);
    if (ball.y > world.bottom - margin && carry.y > 0) carry = unit(carry.x, -Math.abs(carry.y) * .4);

    // 3) Dribble: get behind the ball along the carry line, then push it with soft touches.
    const behindX = ball.x - carry.x * (contact - 4), behindY = ball.y - carry.y * (contact - 4);
    const ahead = (bot.x - ball.x) * carry.x + (bot.y - ball.y) * carry.y;
    let targetX = behindX, targetY = behindY;
    if (ahead > -contact * .35 && ballDistance < contact + 70) {
      // On the wrong side of the ball: go around it instead of pushing it backwards.
      const side = (bot.x - ball.x) * -carry.y + (bot.y - ball.y) * carry.x >= 0 ? 1 : -1;
      targetX = ball.x - carry.x * (contact + 16) - carry.y * side * (contact + 14);
      targetY = ball.y - carry.y * (contact + 16) + carry.x * side * (contact + 14);
    }
    const toX = targetX - bot.x, toY = targetY - bot.y, gap = Math.hypot(toX, toY);
    let moveX, moveY, speed = baseSpeed;
    if (gap > 9 || ballDistance > contact + 26) {
      moveX = toX / (gap || 1); moveY = toY / (gap || 1);
      if (ballDistance > contact + 26) behavior = behavior === 'feint' ? behavior : 'chase';
    } else {
      // Positioned: walk the ball forward just faster than it rolls, so it stays at the feet.
      moveX = carry.x; moveY = carry.y;
      const rolling = Math.max(0, ball.vx * carry.x + ball.vy * carry.y);
      speed = Math.min(baseSpeed * burst, (rolling + 95 * burst) / bot.maxSpeed);
    }
    return { x: moveX, y: moveY, speedMultiplier: clamp(speed, .25, 1.05), kick: false, kickDirection: null, behavior };
  }

  // Bank shot off a touchline: after one bounce the ball must clear the near post
  // and be fully inside the mouth when it crosses the goal line. The wall returns only
  // WALL_RESTITUTION of the vertical speed, so the mirrored target is stretched.
  // Tries targets from the far post inwards; null when none is reachable.
  bankShot(world, ball, wallY, accuracy) {
    const r = ball.radius, top = wallY < ball.y;
    const goalLineX = world.left - r - 2, postX = world.left + r + world.goalPostRadius;
    const mouthTop = world.goalTop + r + world.goalPostRadius + 2, mouthBottom = world.goalBottom - r - world.goalPostRadius - 2;
    const miss = Math.sin((this.shotsTaken + 1) * 2.399) * (1 - accuracy) * 16;
    for (let step = 0; step <= 4; step++) {
      const crossY = (top ? mouthBottom - 8 - step * 22 : mouthTop + 8 + step * 22) + miss;
      const mirroredY = wallY + (wallY - crossY) / WALL_RESTITUTION;
      const dx = goalLineX - ball.x, dy = mirroredY - ball.y;
      if (dx >= -30 || Math.sign(dy) !== Math.sign(wallY - ball.y)) continue;
      const bounceX = ball.x + dx * (wallY - ball.y) / dy;
      if (bounceX < postX + 10 || Math.hypot(dx, dy) > BANK_SHOT_RANGE) continue;
      // Height when passing the near post (straight line from the bounce to the cross point).
      const atPost = wallY + (crossY - wallY) * (bounceX - postX) / (bounceX - goalLineX);
      if (top ? atPost >= mouthTop : atPost <= mouthBottom) return { x: dx, y: dy };
    }
    return null;
  }

  goalAim(world, accuracy, ball) {
    const miss = Math.sin((this.shotsTaken + 1) * 2.399) * (1 - accuracy) * 125;
    const aimY = clamp(world.height / 2 + miss, world.goalTop + 18, world.goalBottom - 18);
    return { x: world.left - 4 - ball.x, y: aimY - ball.y };
  }

  strike(direction, behavior, speedMultiplier) {
    this.shotsTaken++; this.feint = null;
    return { x: 0, y: 0, speedMultiplier, kick: true, kickDirection: direction, behavior };
  }
}

function unit(x, y) { const length = Math.hypot(x, y) || 1; return { x: x / length, y: y / length }; }
function rotate(vector, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}
