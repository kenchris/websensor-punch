import { html, LitElement, query, property } from '@polymer/lit-element';
import { classMap } from 'lit-html/directives/classMap';
import { repeat } from 'lit-html/directives/repeat';

import { EmpiriKit, Sensor } from './empirikit'

interface iHighScore {
  timestamp: number;
  value: number;
  isMax: boolean;
}

interface iVector {
  x: number;
  y: number;
  z: number;
}

class ScoreBoard extends LitElement {
  @property({type:Boolean}) ready: boolean = false;
  @property() highscore: iHighScore[] = [];

  kit = new EmpiriKit();

  private maxSpeed: number = 0;
  private gravity: iVector = { x: 0, y: 0, z: 0 };
  private linearAcceleration: iVector = { x: 0, y: 0, z: 0 };
  private velocity: iVector = { x: 0, y: 0, z: 0 };
  private accel: Sensor | null = null;
  private timeoutId: number | null = null;
  private isDetecting: boolean = false;

  @query('#list')
  private list!: HTMLElement;

  connect() {
    this.kit.connect();

    this.accel = new this.kit.Accelerometer();
    this.accel!.onreading = () => {
      this.ready = true;
      let dt = 0.02; // 50 hertz.

      const bias = 0.8;
      for (let key of ["x", "y", "z"]) {
        // @ts-ignore
        this.gravity[key] = (1 - bias) * this.gravity[key] + bias * this.accel[key];
        // @ts-ignore
        this.linearAcceleration[key] = this.accel[key] - this.gravity[key];
        this.velocity[key] = this.velocity[key] + this.linearAcceleration[key] * dt;
      }

      const vel = this.velocity;
      const velocity = Math.abs(Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2));

      // Average punch for a boxer is 11 m/s, and 1/10th of that for a regular person. 
      const movementThreshold = 0.2;

      if (velocity > movementThreshold) {
        this.isDetecting = true;
        this.maxSpeed = Math.max(this.maxSpeed, velocity);
      }

      if (this.isDetecting && velocity < movementThreshold) {
        if (!this.timeoutId) {
          // When people stop punching they still move the hand back a bit.
          this.timeoutId = setTimeout(() => {
            console.info("Punch!", this.maxSpeed);
            this.isDetecting = false;
            this.timeoutId = null;

            this.updateHighScore(performance.now(), this.maxSpeed);
            this.maxSpeed = 0;
          }, 500);
        }
      }
    }
  }

  async updateHighScore(timestamp: number, value: number) {
    const item: iHighScore = { timestamp: timestamp, value: +value.toFixed(3), isMax: false };
    this.highscore.push(item);
    this.requestUpdate('highscore');

    let highest = Math.max(...this.highscore.map(item => item.value));
    this.highscore.forEach(item => item.isMax = item.value === highest);

    await this.updateComplete;

    const last = this.list.children.length - 1;
    this.list.children[last].scrollIntoView();
  }

  render() {
    return html`
      <style>
        :host{
          text-align: center;
          font-family: 'Lato', sans-serif;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .fancy-button {
          text-align: center;
          display: inline-block;
          position: relative;
          text-decoration: none;
          color: #fff;
          background-color: #541388;
          font-size: 18px;
          padding: 20px 0px;
          width: 150px;
          -webkit-border-radius: 6;
          -moz-border-radius: 6;
          border-radius: 6px;
          overflow: hidden;
        }
        .fancy-button:hover {
          color: #541388;
          background-color: #fff;
        }
        button:focus {
          outline: 0;
        }
        .title {
          padding: 15px;
          font-family: 'Press Start 2P', serif;
        }

        .punch-ul{
          list-style-type: none;
          padding:0;
          margin:0
        }
        .punch-ul li{
          padding: 8px 16px;
          border-bottom: 1px solid #ddd
        }
        .punch-ul li:last-child{border-bottom:none}
        .punch-bar-item{
          text-align: center;
          display: inline;
        }
        .punch-container:after,.punch-container:before, 
        .punch-card-4{
          box-shadow:0 4px 10px 0 rgba(0,0,0,0.2),0 4px 20px 0 rgba(0,0,0,0.19)
        }
        .selected{
          color: #fff;
          background-color: #541388;
        }
        .hidden {
          visibility: hidden;
        }
      </style>
      <button class="fancy-button" @click="${this.connect.bind(this)}" ?disabled="${this.ready}">Connect</button>
      <div class="${classMap({'hidden': !this.ready})}">
        <h1 name="title" role="header" class="title">
          Let's start this game!!!
        </h1>
        <h1 name="title" role="header" class="title">
          👊 Punch! 👊
        </h1>

        <div class="punch-container">
          <ul class="punch-ul punch-card-4" id="list">
          ${repeat(this.highscore, (i) => i.timestamp, (item, index) => html`
            <li class="punch-bar ${classMap({'selected': item.isMax})}">
              <img src="../images/robo${(index % 16 + 1)}.png" width=75 height=75 class="punch-bar-item" style="width: 75px">
              <div class="punch-bar-item">
                <span class="punch-large" aria-label="Player name">Player #${index + 1}</span> |
                <span aria-label="Punch speed">${item.value} m/s</span>
              </div>
            </li>
          `)}
          </ul>
        </div>
      </div>
    `;
  }
}

customElements.define('score-board', ScoreBoard);