import { DungeonGang } from "../index";
import { CommandInteraction, Guild, GuildMemberRoleManager, Snowflake } from "discord.js";
import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "@discordjs/builders";
import Mongo from "../util/Mongo"
import { Client } from "@zikeji/hypixel";
const formatter = new Intl.NumberFormat('en-US')

export default abstract class BaseCommand {
    client: DungeonGang;
    mongo: Mongo;
    formatter: Intl.NumberFormat;
    hypixel: Client;
    conf: {};
    help: {};

    protected constructor(
        client: DungeonGang,
        {
            name = "unnamed",
            description = "No description provided.",
            category = "Miscellaneous",
            usage = "No usage provided.",
            enabled = true,
            guildOnly = true,
            permLevel = 2,
            slashCommandBody = <Partial<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>>new SlashCommandBuilder()
        }
    ) {
        this.client = client;
        this.mongo = client.mongo;
        this.formatter = formatter;
        this.hypixel = client.hypixel;
        this.conf = { enabled, guildOnly, permLevel, slashCommandBody };
        this.help = { name, description, category, usage };
    }

    abstract execute(interaction: CommandInteraction): void
    toProperCase(word: string) {
        return word.charAt(0).toUpperCase() + word.slice(1)
    }
    arrayRoleIds(roles: GuildMemberRoleManager) {
        return roles.cache.map(role => role.id)
    }
    async fetchMember(id: Snowflake, guild: Guild) {
        return guild.members.fetch(id)
            .catch(() => {
                return undefined
            })
    }
    removeDuplicates(array: any[]) {
        return [...new Set(array)]
    }

}