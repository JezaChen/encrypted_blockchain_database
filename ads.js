const Web3 = require("web3");

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:7545"));

module.exports = class ADS {
    constructor(from_addr, to_addr) {
        this.from_addr = from_addr;
        this.to_addr = to_addr;
    }

    _put(value) {
        return new Promise(((resolve, reject) => {
            web3.eth.sendTransaction({
                from: this.from_addr,
                to: this.to_addr,
                value: web3.utils.toWei("0", "wei"),
                data: value
            }).then(
                receipt => {
                    resolve(receipt.transactionHash);
                },

                reason => {
                    reject(reason)
                });
        }));

    }

    _get(addr) {
        return new Promise(((resolve, reject) => {
            web3.eth.getTransaction(addr).then(
                tran => {
                    let value = tran.input;
                    resolve(value);
                },
                reason => {
                    reject(reason);
                }
            )
        }));

    }

    put(type, value) {
        return this._put(web3.eth.abi.encodeParameter(type, value));
    }

    get(type, addr) {
        return new Promise(((resolve, reject) => {
            this._get(addr).then(
                (value) => resolve(web3.eth.abi.decodeParameter(type, value))
            ).catch(
                (err) => reject(err)
            );
        }));

    }
}
