/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

const SHA256 = require('crypto-js/sha256');

/* ===== Persist data with LevelDB ===================================
|  Learn more: level: https://github.com/Level/level     |
|  =============================================================*/

const level = require('level');
const chainDB = './blockchaindata';
const db = level(chainDB);

// get levelDB data length
function getDataToLevelDBLength() {
  return new Promise((resolve, reject) => {
    let length = 0;
    db.createReadStream().on('data', (data) => {
      length++;
    }).on('error', (err) => {
      console.log('Unable to read data stream!', err);
      reject(err);
    }).on('close', () => {
      resolve(length);
    });
  });
}

// Get data from levelDB with key
function getLevelDBData(key) {
  return new Promise((resolve, reject) => {
    db.get(key, function (err, value) {
      if (err) return console.log('Not found!', err);
      resolve(value);
    })
  });
}

// Add data to levelDB with value
function addDataToLevelDB(value) {
  return new Promise(((resolve, reject) => {
    let i = 0;
    db.createReadStream().on('data', (data) => {
      i++;
    }).on('error', (err) => {
      return console.log('Unable to read data stream!', err)
    }).on('close', () => {
      db.put(i, value, (err) => {
        if (err) return console.log('Block ' + i + ' submission failed', err);
        resolve(true)
      })
    });
  }));
}


/* ===== Block Class ==============================
|  Class with a constructor for block 			   |
|  ===============================================*/

class Block {
  constructor(data) {
    this.hash = "",
      this.height = 0,
      this.body = data,
      this.time = 0,
      this.previousBlockHash = ""
  }
}

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

function createGenesisBlock() {
  return getDataToLevelDBLength().then((length) => {
    if (length === 0) {
      return Blockchain.addBlock(new Block("First block in the chain - Genesis block"));
    }
  });
}

class Blockchain {
  // Add new block
  static addBlock(newBlock) {
    // Block height
    return getDataToLevelDBLength().then(length => {
      newBlock.height = length;
      // UTC timestamp
      newBlock.time = new Date().getTime().toString().slice(0, -3);
      // previous block hash
      if (length > 0) {
        return getLevelDBData(length - 1);
      }
    }).then((block) => {
      if (block) {
        newBlock.previousBlockHash = JSON.parse(block).hash;
      }
    }).then(() => {
      // Block hash with SHA256 using newBlock and converting to a string
      newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
      // Adding block object to chain
      return addDataToLevelDB(JSON.stringify(newBlock));
    }).then((result) => {
      console.log(`Add Block ${newBlock.body} ${result}`);
    });
  }

  // Get block height
  static getBlockHeight() {
    return getDataToLevelDBLength().then(length => {
      return length - 1
    });
  }

  // get block
  static getBlock(blockHeight) {
    // return object as a single string
    return getLevelDBData(blockHeight).then((block) => {
      return JSON.parse(block);
    });
  }

  // validate block
  static validateBlock(blockHeight) {
    // get block object
    return this.getBlock(blockHeight).then((block) => {
      // get block hash
      let blockHash = block.hash;
      // remove block hash to test block integrity
      block.hash = '';
      // generate block hash
      let validBlockHash = SHA256(JSON.stringify(block)).toString();

      // Compare
      if (blockHash === validBlockHash) {
        return true;
      } else {
        console.log('Block #' + blockHeight + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
        return false;
      }
    });
  }

  // Validate blockchain
  static validateChain() {
    let errorLog = [];
    let promiseArray = [];
    return getDataToLevelDBLength().then((length) => {
      for (let i = 0; i < length - 1; i++) {
        console.log(`Checking block ${i}`);

        // validate block
        let pos = i;
        let blockHash = "";
        let previousHash = "";

        promiseArray.push(this.validateBlock(pos).then(result => {
          if (!result) {
            errorLog.push(pos)
          }
        }).then(() => {
          // compare blocks hash link
          return getLevelDBData(pos);
        }).then((block) => {
          blockHash = JSON.parse(block).hash;

          return getLevelDBData(pos + 1)
        }).then((block) => {
          previousHash = JSON.parse(block).previousBlockHash;

          if (blockHash !== previousHash) {
            errorLog.push(pos);
          }
        }));
      }
      return Promise.all(promiseArray).then(() => {
        if (errorLog.length > 0) {
          console.log('Block errors = ' + errorLog.length);
          console.log('Blocks: ' + errorLog);
        } else {
          console.log('No errors detected');
        }
      });
    });
  }
}


/* ===== Test Case ==========================
|  Test cases 		|
|  ================================================*/
createGenesisBlock().then(() => {
  return Blockchain.addBlock(new Block("a"));
}).then(() => {
  return Blockchain.addBlock(new Block("b"));
}).then(() => {
  return getDataToLevelDBLength();
}).then((value) => {
  console.log(value);
}).then(() => {
  return Blockchain.getBlock(0);
}).then((value) => {
  console.log(value);
}).then(() => {
  return Blockchain.getBlock(1);
}).then((value) => {
  console.log(value);
}).then(() => {
  return Blockchain.getBlock(2);
}).then((value) => {
  console.log(value);
}).then(() => {
  console.log("---- validateChain----");
  return Blockchain.validateChain();
}).then(() => {
  console.log("----modify block 1:height 2-----");
  console.log("----remove block 1:height 2 previousBlockHash-----");
  return Blockchain.getBlock(2);
}).then((value) => {
  a = value;
  a.previousBlockHash = '';
  console.log(a);
  return db.put(2, JSON.stringify(a));
}).then((value) => {
  console.log("---- validateChain again----");
  return Blockchain.validateChain();
})