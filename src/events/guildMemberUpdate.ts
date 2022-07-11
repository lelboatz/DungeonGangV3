import {GuildMember} from "discord.js";
import {DungeonGang} from "../index";

module.exports = class {
    client: DungeonGang
    constructor(client: DungeonGang) {
        this.client = client
    }

    async run(oldMember: GuildMember, newMember: GuildMember) {
        if (!oldMember.roles.cache.has(this.client.config.discord.roles.member) && !oldMember.roles.cache.has(this.client.config.discord.roles.verified) && newMember.roles.cache.has(this.client.config.discord.roles.member) && !newMember.roles.cache.has(this.client.config.discord.roles.verified)) {
            if (newMember.manageable) {
                return newMember.setNickname("❮?❯ An_Unlinked_User")
            }
        }
    }
}