"use strict";

const Web3 = require("web3");
const ADS = require("./ads.js");
const crypto = require('crypto');
const AES256 = require('./crypto_utils').AES256;

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:7545"));

class Client {
    init(server) {
        this.key = AES256.generate_key();
        this.iv = AES256.generate_iv();
        this.dx = {};
        this.server = server
    }

    async edit(type, label, value) {
        let r0 = this.dx[label];
        if (r0 === undefined) r0 = null;

        let stringify_value = JSON.stringify(value);
        if (r0 !== null) stringify_value = "," + stringify_value; //加上逗号, 以便与之前加入的数据相区分
        let blocks = stringify_value.match(/.{1,200}/g); //split data

        let r = new Array(blocks.length * 2 + 1);
        r.fill(null);

        for (let i = blocks.length - 1; i >= 0; i--) {
            let data = {
                b: blocks[i], //B^{i}
                lp: r[2 * i + 1],
                rp: r[2 * i + 2],
                t: type
            };
            if (i === 0) data.dxl = r0;

            let stringified_data = JSON.stringify(data);
            let cipher = AES256.encrypt(this.key, stringified_data, this.iv);
            r[i] = await this.server.edit(cipher);
        }
        this.dx[label] = r[0];
    }

    async query(label) {
        let r_root = this.dx[label];
        let V = [], Vd = [];
        while (r_root !== null) {
            let e = await this.server.query(r_root);
            let data = AES256.decrypt(this.key, e, this.iv);
            data = JSON.parse(data);

            let s = [] //stack
            s.push(r_root);
            r_root = data.dxl; //下一轮要迭代的根节点

            while (s.length !== 0) {
                let r = s.pop();
                e = await this.server.query(r);
                data = AES256.decrypt(this.key, e, this.iv);
                data = JSON.parse(data);
                if (data.t === "add") {
                    V.push(data.b);
                } else {
                    Vd.push(data.b);
                }
                if (data.lp !== null) s.push(data.lp);
                if (data.rp !== null) s.push(data.rp);
            }
        }
        V.reverse();
        let stringified_result = "[" + V.join('') + "]";
        let results_containing_deleted_ones = JSON.parse(stringified_result);

        Vd.reverse();
        if (Vd.length > 0 && Vd[0][0] === ',') Vd[0] = Vd[0].substr(1); //Vd第一个元素首字符可能会包含逗号，因此需要去掉
        stringified_result = "[" + Vd.join('') + "]";
        let deleted_results = JSON.parse(stringified_result);

        return results_containing_deleted_ones.filter(el => !deleted_results.includes(el));
    }
}

class Server {
    async init(client) {
        this.client = client;
        const accounts = await web3.eth.getAccounts();
        this.ads = new ADS(accounts[0], accounts[1]);
    }

    async edit(cipher) {
        return await this.ads.put("string", cipher);
    }

    async query(r) {
        return await this.ads.get("string", r);
    }
}


(async () => {
    let client = new Client();
    let server = new Server();
    client.init(server);
    await server.init(client);
    await client.edit("add", "China", {a: "aaa", b: "bbb"});
    await client.edit("add", "China", "bbbbbb");
    await client.edit("add", "China", {a: "aaa", b: "bbb"});
    await client.edit("del", "China", "bbbbbb"); //todo 无法删除object类型元素

    let res = await client.query("China");
    console.log(res);
})();

exports.web3 = web3

