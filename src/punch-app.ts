import { html, css, LitElement, query, property, customElement } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';

import "@material/mwc-button";

import { EmpiriKit, Sensor } from './empirikit'

interface iHighScore {
  timestamp: number;
  player: number;
  value: number;
  selected: boolean;
}

interface iVector {
  x: number;
  y: number;
  z: number;
}

declare global {
  interface HTMLElementTagNameMap {
    'punch-app': PunchApp;
  }
}

@customElement('punch-app')
class PunchApp extends LitElement {
  @property({type:String}) page: string = "start";

  @property() highscore: iHighScore[] = [];
  @property({type:Number}) player: number = 0;

  @query('#turn')
  turn!: HTMLElement;

  @query('#go')
  go!: HTMLElement;

  kit = new EmpiriKit();

  private maxSpeed: number = 0;
  private gravity: iVector = { x: 0, y: 0, z: 0 };
  private linearAcceleration: iVector = { x: 0, y: 0, z: 0 };
  private velocity: iVector = { x: 0, y: 0, z: 0 };
  private accel: Sensor | null = null;
  private timeoutId: number | null = null;
  private isDetecting: boolean = false;

  private block: boolean = false;

  @query('#list')
  private list!: HTMLElement;

  constructor() {
    super();

    this.accel = new this.kit.Accelerometer();

    this.accel!.onreading = () => {
      if (this.block) {
        return;
      }

      let dt = 0.01; // 100 hertz.

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
          this.timeoutId = window.setTimeout(() => {
            console.info(`Punch from player ${this.player}!`, this.maxSpeed);
            this.isDetecting = false;
            this.timeoutId = null;

            this.updateHighScore(this.player, performance.now(), this.maxSpeed);
            this.maxSpeed = 0;
            this.player = (this.player + 1) % 3;
          }, 500);
        }
      }
    }
  }

  async connect() {
    const success = await this.kit.connect();
    if (success) {
      this.fadePlayerIn();
    }
  }

  fadePlayerOut() {
    this.turn.style.opacity = "0";
    this.go.style.visibility = "hidden";
  }

  fadePlayerIn() {
    this.block = true;
    // @ts-ignore
    const animation = this.turn.animate([
      { opacity: 0 },
      { opacity: 1 }
    ], {delay: 1000, duration: 500});

    animation.onfinish = () => {
      this.turn.style.opacity = "1";
      this.go.style.visibility = "visible";
      this.block = false;
      this.page = "action";
    }
  }

  reset() {
    this.highscore = [];
    this.page = 'action';
    this.fadePlayerIn();
  }

  async updateHighScore(player: number, timestamp: number, value: number) {
    if (this.highscore.length === 9) {
      return;
    }
    this.fadePlayerOut();

    const item: iHighScore = { player, timestamp, value: +value.toFixed(3), selected: true};
    this.highscore.push(item);

    this.highscore = this.highscore.sort((a, b) => b.value - a.value);

    this.highscore.forEach(item => item.selected = item.timestamp === timestamp);
    this.requestUpdate('highscore');

    if (this.highscore.length === 9) {
      setTimeout(() => {
        this.page = "winner";
      }, 1000);
    } else {
      this.fadePlayerIn();
    }

    await this.updateComplete;

    const last = this.highscore.findIndex(item => item.timestamp === timestamp);

    this.list.children[last].scrollIntoView();
  }

  static get styles() {
    return [css`
      :host{
        text-align: center;
        font-family: 'Lato', sans-serif;
        display: block;
        margin-left: auto;
        margin-right: auto;
      }

      .title {
        margin: 0px;
        padding: 0px;
        font-family: 'Press Start 2P', sans-serif;
        z-index: 100;
        position: fixed;
        top: 0px;
        right: 0px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        height: 100vh;
        width: 100vw;
        pointer-events: none;
        background: white;
        opacity: 0;
      }

      #go {
        visibility: hidden;
      } 

      .punch-ul{
        list-style-type: none;
        padding:0;
        margin:0
      }
      .punch-ul li{
        padding: 0px;
        border-bottom: 1px solid #ddd
      }
      .selected{
        color: #fff;
        background-color: #541388;
      }
      .hidden {
        visibility: hidden;
      }
      .page {
        display: none;
      }
      .page[active] {
        display: block;
      }
    `];
  }

  render() {
    return html`
      <div id="turn" role="header" class="title">
        <h1>👊 Punch Player #${this.player + 1} 👊</h1>
        <h1 id="go">GO!</h1>
      </div>

      <main role="main" class="main-content">
        <div class="page" ?active="${this.page === 'start'}">
          <h1>Please connect<br>to start the game!</h1>
          <mwc-button @click="${this.connect.bind(this)}">Connect</mwc-button>
        </div>

        <div class="page" ?active="${this.page === 'winner'}">
          <h1>And the winner is<br>${this.highscore.length > 0 ? `Player #${this.highscore[0].player + 1}` : ''}!</h1>
          <mwc-button @click="${this.reset.bind(this)}">Try again!</mwc-button>
        </div>

        <div class="page" ?active="${this.page === 'action'}">
          <div class="punch-container">
            <ul class="punch-ul punch-card-4" id="list">
            ${repeat(this.highscore, (i) => i.timestamp, (item) => html`
              <li class="punch-bar ${classMap({'selected': item.selected})}">
                <img src="./images/robo${(item.player % 16 + 1)}.png" width=75 height=75 class="punch-bar-item" style="width: 75px">
                <div class="punch-bar-item">
                  <span class="punch-large" aria-label="Player name">Player #${item.player + 1}</span> |
                  <span aria-label="Punch speed">${item.value} m/s</span>
                </div>
              </li>
            `)}
            </ul>
          </div>
        </div>
      </main>
    `;
  }
}