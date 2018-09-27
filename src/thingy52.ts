// @license
// Copyright (c) 2018 Kenneth Christiansen. All rights reserved.
export interface Sensor {
  onreading: Function | null;
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

export class Thingy52 {
  private data: any;
  private observers: Sensor[];
  Accelerometer: any;

  private readonly THINGY_UUID = 'ef680100-9b35-4933-9b10-52ffa9740042';
  private readonly MOTION_SERVICE_UUID = 'ef680400-9b35-4933-9b10-52ffa9740042';
  private readonly RAWDATA_CHARACTERISTIC_UUID = 'ef680406-9b35-4933-9b10-52ffa9740042';
  private readonly CONFIG_CHARACTERISTIC_UUID = "ef680401-9b35-4933-9b10-52ffa9740042";

  constructor() {
    this.data = {};
    this.observers = [];

    const createSensor = (parent: Thingy52, key: string) => class implements Sensor {
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
    let navigatorObject: any = window.navigator;
    if (navigatorObject && navigatorObject.bluetooth) {
      // Here write your logic of navigatorObject.bluetooth.requestDevice();
      const device = await navigatorObject.bluetooth.requestDevice({
        filters: [{ services: [this.THINGY_UUID] }],
        optionalServices: [this.MOTION_SERVICE_UUID]
      });

      if (!device) {
        return;
      }

      // @ts-ignore
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(this.MOTION_SERVICE_UUID);

      const config = await service.getCharacteristic(this.CONFIG_CHARACTERISTIC_UUID);

      let options: DataView = await config.readValue();

      const frequency = 60;
      options.setUint8(6, frequency & 0xff);
      options.setUint8(7, (frequency >> 8) & 0xff);
      await config.writeValue(options);

      const characteristic = await service.getCharacteristic(this.RAWDATA_CHARACTERISTIC_UUID);

      const onrawdatareceived = (event: Event) => {
        // @ts-ignore
        const value = event.target.value;
        const littleEndian = true;

        // unit G (9.8 m/s²)
        this.data.accelerometer = {
          x: 9.8 * (value.getInt16(0, littleEndian) / 2 ** 10),
          y: 9.8 * (value.getInt16(2, littleEndian) / 2 ** 10),
          z: 9.8 * (value.getInt16(4, littleEndian) / 2 ** 10),
          timestamp: event.timeStamp
        };

        // unit deg/s: 11 bit precision
        this.data.gyroscope = {
          x: value.getInt16(6, littleEndian) / 2 ** 11,
          y: value.getInt16(8, littleEndian) / 2 ** 11,
          z: value.getInt16(10, littleEndian) / 2 ** 11,
          timestamp: event.timeStamp
        };

        // unit micro tesla: 12 bit precision
        this.data.compass = {
          x: value.getInt16(12, littleEndian) / 2 ** 12,
          y: value.getInt16(14, littleEndian) / 2 ** 12,
          z: value.getInt16(16, littleEndian) / 2 ** 12,
          timestamp: event.timeStamp
        };

        for (let observer of this.observers) {
          if (typeof observer.onreading === "function") {
            observer.onreading();
          }
        }
      }

      characteristic.addEventListener('characteristicvaluechanged', onrawdatareceived);
      characteristic.startNotifications();
    }
  }
}