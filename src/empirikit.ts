import {COBSDecoderStream} from './cobs.js';

export interface Sensor {
  onreading: Function | null;
  x: number;
  y: number;
  z: number;
}

export class EmpiriKit {
  Accelerometer: any;
  private device: any = null;
  private writer: any;

  constructor() {
    const decoder = new COBSDecoderStream();
    this.writer = decoder.writableStream.getWriter();
    const reader = decoder.readableStream.getReader();

    navigator.usb.getDevices().then(devices => this.device = devices[0]);
    navigator.usb.addEventListener('connect', ev => this._openDevice(ev.device));

    this.Accelerometer = class implements Sensor {
      onreading = null;
      x: number = 0;
      y: number = 0;
      z: number = 0;

      constructor() {
        const process = chunk => {
          let { done, value } = chunk;
          if (done) {
            return;
          }

          const view = new DataView(value.buffer);

          //const sampleRate = view.getUint16(0, true);
          //console.log("Rate", sampleRate);
          //console.log("Touch", view.getUint16(2, true));
          this.x = 9.82 * view.getInt16(4, true) / 2 ** 12;
          this.y = 9.82 * view.getInt16(6, true) / 2 ** 12;
          this.z = 9.82 * view.getInt16(8, true) / 2 ** 12;

          if (typeof this.onreading === "function") {
            // @ts-ignore
            this.onreading();
          }
          return reader.read().then(process);
        };
        reader.read().then(process);
      }
    }
  }

  async connect() {
    this.device = await navigator.usb.requestDevice({filters: [{vendorId: 0x1209, productId: 0xD017}]});

    if (this.device) {
      console.info(this.device);
      this._openDevice(this.device); // Begin a session.
    }
  }

  async _openDevice(device) {
    try {
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(2);
      await device.controlTransferOut({
        requestType: 'class',
        recipient: 'interface',
        request: 0x22,
        value: 0x01,
        index: 0x02
      });

      this.device = device;
      if (!device) {
        return;
      }
      this.readFromDevice();
      this.send('{"SETBIN":1}');
      this.send('{"SETRTE":100}');
      this.send('{"STRTCH":1}');
      this.send('{"STRACC":1}');
    } catch(err) {
      console.error(err);
    }
  }

  async readFromDevice() {
    const transfer = await this.device.transferIn(5, 32);
    const data = new Uint8Array(transfer.data.buffer);
    this.writer.write(data);
    this.readFromDevice();
  }

  send(string) {
    if (!this.device) {
      return;
    }

    // @ts-ignore
    const data = new TextEncoder('utf-8').encode(string);
    console.log(`Sending to serial: [${string}]`, data);

    this.device.transferOut(5, data);
  };
}