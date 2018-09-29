export const encode = buffer => {
  let result = [];
  let resultIter = 0;

  let overheadBytePosition = 0;
  let overheadByte = 0x01;

  const startBlock = () => {
    overheadBytePosition = resultIter++;
    overheadByte = 0x01;
  }

  const endBlock = () => {
    result[overheadBytePosition] = overheadByte;
  }

  startBlock();
  let bufferIter = 0;
  while (bufferIter < buffer.length) {
    if (overheadByte != 0xFF) {
      const value = buffer[bufferIter++];
      if (value != 0x00) {
        result[resultIter++] = value;
        overheadByte++;
        continue;
      }
    }
    endBlock();
    startBlock();
  }
  endBlock();

  return result;
}

export const decode = buffer => {
  let result = [];
  let resultIter = 0;

  let overheadByte = 0xff;
  let copy = 0x00;

  let i = 0;
  while (i < buffer.length) {
    if (copy != 0x00) {
      result[resultIter++] = buffer[i++];
    } else {
      if (overheadByte != 0xff) {
        result[resultIter++] = 0x00;
      }
      copy = overheadByte = buffer[i++];
      if (overheadByte == 0x00) {
        break; // source length too long
      }
    }
    copy--;
  }

  return result;
}