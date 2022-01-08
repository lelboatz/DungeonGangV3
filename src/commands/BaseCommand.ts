import { DungeonGang } from "../index";
import {
    CommandInteraction,
    Guild, GuildMember,
    GuildMemberRoleManager,
    MessageContextMenuInteraction,
    Snowflake, UserContextMenuInteraction
} from "discord.js";
import { SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, ContextMenuCommandBuilder } from "@discordjs/builders";
import Mongo from "../util/Mongo"
import { Client } from "@zikeji/hypixel";
import { errorEmbed } from "../util/Functions";
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
            slashCommandBody = <Partial<SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder>>new SlashCommandBuilder(),
            messageContextMenuCommandBody = <Partial<ContextMenuCommandBuilder> | undefined>undefined,
            userContextMenuCommandBody = <Partial<ContextMenuCommandBuilder> | undefined>undefined,
        }
    ) {
        this.client = client;
        this.mongo = client.mongo;
        this.formatter = formatter;
        this.hypixel = client.hypixel;
        this.conf = { enabled, guildOnly, permLevel, slashCommandBody, messageContextMenuCommandBody, userContextMenuCommandBody };
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
    async getMemberFromContextMenuInteraction(interaction: MessageContextMenuInteraction | UserContextMenuInteraction) {
        let member;
        if (interaction.isMessageContextMenu()) {
            member = interaction.targetMessage.member
            if (!member) {
                member = await this.fetchMember(interaction.targetMessage.author.id, interaction.guild!)
            }
        } else {
            member = interaction.targetMember
            if (!member) {
                member = await this.fetchMember(interaction.targetUser.id, interaction.guild!)
            }
        }
        return (member as GuildMember | undefined)
    }

}