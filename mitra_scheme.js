"use strict";

const Web3 = require("web3");
const ADS = require("./ads.js");
const crypto = require('crypto');
const AES256 = require('./crypto_utils').AES256;
const HMAC_SHA256 = require('./crypto_utils').HMAC_SHA256;

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:7545"));


class Client {
    init(server) {
        this.file_cnt = {};
        this.k = crypto.randomBytes(64);
        this.server = server;
    }

    concat_id_op(id, op) {
        if (typeof id !== "bigint") {
            id = BigInt(id); //convert id to BigInt type
        }
        if (id >= 1n << 255n) throw new Error("Out of bound");
        let result = Buffer.alloc(32);
        result.writeBigUInt64LE(id % (1n << 64n));
        result.writeBigUInt64LE((id % (1n << 128n)) / (1n << 64n), 8);
        result.writeBigUInt64LE((id % (1n << 192n)) / (1n << 128n), 16);
        result.writeBigUInt64LE((id % (1n << 256n)) / (1n << 192n), 24);
        if (op === "add" || op === 1) {
            result[31] |= 1;
        } else {
            result[31] &= ~1;
        }
        return result;
    }

    read_id_op(buf) {
        let op_flag = buf[31] & 1;
        buf[31] &= ~1;
        let id = buf.readBigUint64LE(0) +
            buf.readBigUint64LE(8) * (1n << 64n) +
            buf.readBigUint64LE(16) * (1n << 128n) +
            buf.readBigUint64LE(24) * (1n << 192n);
        return {id: id, op: op_flag === 1 ? "add" : "del"};
    }

    concat_w_file_cnt_num(w, file_cnt, num) {
        let w_buf = Buffer.from(w);
        let file_cnt_and_num_buf = Buffer.alloc(5);
        file_cnt_and_num_buf.writeUInt32LE(file_cnt, 0);
        file_cnt_and_num_buf.writeInt8(num, 4);
        return Buffer.concat([w_buf, file_cnt_and_num_buf]);
    }

    xor_buffer(buf1, buf2) {
        if (!Buffer.isBuffer(buf1) || !Buffer.isBuffer(buf2)) throw new Error("buf1 and buf2 should be Buffer!");
        if (buf1.length !== buf2.length) throw new Error("The length of buf1 should be same as that of buf2");
        let result = Buffer.alloc(buf1.length);
        for (let i = 0; i < buf1.length; ++i) result[i] = buf1[i] ^ buf2[i];
        return result;
    }

    async edit(type, keyword, file_id) {
        if (this.file_cnt[keyword] === undefined) this.file_cnt[keyword] = 0;
        this.file_cnt[keyword]++;
        let addr = HMAC_SHA256.digest(this.k,
            this.concat_w_file_cnt_num(keyword, this.file_cnt[keyword], 0)).toString("base64");
        let val = this.xor_buffer(this.concat_id_op(file_id, type),
            HMAC_SHA256.digest(this.k, this.concat_w_file_cnt_num(keyword, this.file_cnt[keyword], 1))).toString("base64");
        this.server.edit(addr, val);
    }

    async query(keyword) {
        let t_list = []
        for (let i = 1; i <= this.file_cnt[keyword]; ++i) {
            let t_i = HMAC_SHA256.digest(this.k, this.concat_w_file_cnt_num(keyword, i, 0)).toString("base64");
            t_list.push(t_i);
        }
        let f_w = await this.server.query(t_list);
        let r_w_add = [], r_w_del = [];
        for (let i = 1; i <= f_w.length; ++i) {
            let tmp = this.xor_buffer(Buffer.from(f_w[i - 1], "base64"), HMAC_SHA256.digest(this.k, this.concat_w_file_cnt_num(keyword, i, 1)));
            tmp = this.read_id_op(tmp);
            if (tmp.op === "add")
                r_w_add.push(tmp.id);
            else r_w_del.push(tmp.id);
        }
        return r_w_add.filter(el => !r_w_del.includes(el));
    }
}

class Server {
    async init(client) {
        this.client = client;
        const accounts = await web3.eth.getAccounts();
        this.ads = new ADS(accounts[0], accounts[1]);
        this.dictW = {};
    }

    async edit(addr, val) {
        this.dictW[addr] = val;
    }

    async query(t_list) {
        let f_w = [];
        for (let i = 0; i < t_list.length; i++) {
            f_w.push(this.dictW[t_list[i]]);
        }
        return f_w;
    }
}


(async () => {
    let client = new Client();
    let server = new Server();
    client.init(server);
    await server.init(client);
    await client.edit("add", "China", 122);
    await client.edit("add", "China", 223);
    await client.edit("del", "China", 122);
    await client.edit("add", "Chi", 221);

    let res = await client.query("China");
    console.log(res);
})();

exports.web3 = web3

