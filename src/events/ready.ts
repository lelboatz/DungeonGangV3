import { DungeonGang } from "../index";

module.exports = class {
    client: DungeonGang
    constructor(client: DungeonGang) {
        this.client = client
    }
    async run() {
        import ("../util/Console")
        console.log(`Logged in as ${this.client.user?.tag}`)
        this.client.user?.setStatus("online")
    }
}