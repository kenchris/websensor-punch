
export interface Sensor {
  onreading: Function | null;
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

export class EmpiriKit {
  private data: any;
  private observers: Sensor[];
  Accelerometer: any;
  private rstring: string = "";
  private device: any = null;

  constructor() {
    this.data = {};
    this.observers = [];

    navigator.usb.getDevices().then(devices => this.device = devices[0]);
    navigator.usb.addEventListener('connect', ev => this._openDevice(ev.device));

    const createSensor = (parent: EmpiriKit, key: string) => class implements Sensor {
      onreading = null;

      constructor() {
        parent.observers.push(this);
      }
      get timestamp() { return parent.data[key].timestamp; }
      get x() { return parent.data[key].x; }
      get y() { return parent.data[key].y; }
      get z() { return parent.data[key].z; }
    }

    this.Accelerometer = createSensor(this, "accelerometer");
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
      this.rstring = "";
      this.readFromDevice(); // Waiting for 64 bytes of data from endpoint #5.
      //this.send(`{"SETRTE":50}`);
      this.send('{"STRACC":1}');
    } catch(err) {
      console.error(err);
    }
  }

  onData(data) {
    switch (data.datatype) {
      case "StreamData": {
        this.data.accelerometer = {
          x: 9.82 * data.accelerometerdata[0] / 2 ** 12,
          y: 9.82 * data.accelerometerdata[1] / 2 ** 12,
          z: 9.82 * data.accelerometerdata[2] / 2 ** 12
        };
      }
    }

    for (let observer of this.observers) {
      if (typeof observer.onreading === "function") {
        observer.onreading();
      }
    }
  }

  async readFromDevice() {
    const result = await this.device.transferIn(5, 64);

    const decoder = new TextDecoder();
    this.rstring += decoder.decode(result.data);
    // do a quick JSON smoketest (should do better with decoder/streaming)
    const startIdx = this.rstring.indexOf('{');
    if (startIdx > 0) this.rstring = this.rstring.substring(startIdx);
    const endIdx = this.rstring.indexOf('}');
    if (endIdx > -1) {
        const parseStr = this.rstring.substring(0, endIdx+1);
        this.rstring = this.rstring.substring(endIdx+1);
        try {
            const data = JSON.parse(parseStr);
            this.onData(data);
        } catch(e) {
            console.error(e, parseStr);
        }
        this.rstring = "";
    }
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