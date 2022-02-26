import { DungeonGang } from "../index";
import { GuildMember } from "discord.js";
import { DiscordUser } from "./Mongo";

interface PunishOptions {
    user: DiscordUser
    member: GuildMember
    punisher: GuildMember
    reason: string
    duration: number
    shortDescription?: string
    punishment: {
        reason: string
        id: string
        severity: number
    }
    type: "WARN" | "TIMEOUT" | "TEMP_BAN" | "PERM_BAN"
}

class PunishmentManager {
    client: DungeonGang;
    constructor(client: DungeonGang) {
        this.client = client;
    }

    createActivePunishment(options: PunishOptions) {
        return {

        }
    }
}