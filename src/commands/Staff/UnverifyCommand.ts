import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, Guild } from "discord.js";
import { embed, ephemeralMessage, errorEmbed } from "../../util/Functions";
import { MongoUser } from "../../util/Mongo";

module.exports = class UnverifyCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "unverify",
            category: "Staff",
            usage: "unverify <user>",
            description: "Unverifies a user.",
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("unverify")
                .setDescription("Unverifies a user.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to unverify.")
                )
        })
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const user = interaction.options.getUser("user", true);
        const member = await this.fetchMember(user.id, interaction.guild as Guild);
        if (!member) {
            return interaction.editReply({
                embeds: [errorEmbed("That user is not in this server.")]
            });
        }

        if (!member.manageable) {
            return interaction.editReply({
                embeds: [errorEmbed("You cannot unverify someone with a role that is higher than the bot!")]
            });
        }

        if (member.roles.botRole) {
            return interaction.editReply({
                embeds: [errorEmbed("You cannot unverify a bot with a managed role!")]
            });
        }

        let users = await this.mongo.getUsersByDiscord(member.id) as MongoUser[] | undefined;

        users?.forEach(async (user) => {
            user.discordId = undefined;
            await this.mongo.updateUser(user);
        });

        await member.edit({
            roles: this.client.config.discord.roles.fixRoles,
            nick: member.manageable ? null: undefined,
        }, `Unverified by ${interaction.user.tag}`);

        return interaction.editReply({
            embeds: [
                embed("Unverified!", `<@${member.user.id}> has been successfully unverified.`)
            ]
        })
    }
}