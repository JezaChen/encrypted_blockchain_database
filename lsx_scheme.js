"use strict";

const Web3 = require("web3");
const ADS =  require("./ads.js");
const crypto = require('crypto');
const AES256 = require('./crypto_utils').AES256;

const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:7545"));

function transferTo(from, to, val) {
    web3.eth.sendTransaction({from: from, to: to, value: val}).then(console.log);
}



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
        let blocks = stringify_value.match(/.{1,200}/g);
        let r_prev = r0;
        for (let i = 0; i < blocks.length; i++) {
            let data = {
                b: blocks[i], //B^{i}
                r: r_prev, //r^{i-1}
                t: type //ADD or DEL
            };
            let cipher = AES256.encrypt(this.key, JSON.stringify(data), this.iv);
            r_prev = await this.server.edit(cipher);
        }
        this.dx[label] = r_prev;
    }

    async query(label) {
        let r = this.dx[label];
        let V = [];
        while (r !== null) {
            let e = await this.server.query(r);
            let data = AES256.decrypt(this.key, e, this.iv);
            data = JSON.parse(data);
            if (data.t === "add") {
                V.push(data.b);
            }
            r = data.r; //链接上一个位置
        }
        V.reverse();
        return V.join('');
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
    let client = new Client()
    let server = new Server()
    client.init(server)
    await server.init(client)
    await client.edit("add", "China", "44dCG1lr9PGHzrosB3AANBXLgKV2lOkojc1kaPzfxXGmCPKKWcIdgPPfvvY5aQpahmwg79enZioGy4hIMhCdKp5VxFd9PLwUjaAlN3qkQnfe3nEKNZSeP4Yt7yukJOYFxiPBvQJE5ZBWW3QwIqvvoDZ4lYTOifzbYKp7aIksweFU8yknsuy8p4JcNzH3uLrrGCs1qFI5nRmSZvGmR2wLDZVkksRzup2mxPMxlej1XElzgkVuc7OV4y8vTsZuih5EloAumyNHMp12El8PqPxaH1TuQ3PvLUbCqMrFEcCx9gVHkC9qQAlnVsqUzC2bJwSCjrKaqG4WOmIpSaMYStf1hpO35oWPkB3S29qNDdlZeV43mN55Y0oGbcVe8R2vZz4NjQl68zMhBzuTMMl4ecwGNyHcUH4maKs5Z1yxB8il95Nlf3NE7Zw4Kb3wQoO6A7uqRh4T5Fre8reuEaTSHTrCPyT3IA97wnkpTROkKnjTMHQQKCovlTQAEJUg6Inq0i09cQC732Snvq8nCMmgnnJkOWRTD8ShMQ6JsliKcNnaRozc1dTWZXhPwz9vIaSSfXjRq6fAiVSGMDbKtqdNpwweRday")
    let res = await client.query("China")
    console.log(res)
})();

exports.web3 = web3