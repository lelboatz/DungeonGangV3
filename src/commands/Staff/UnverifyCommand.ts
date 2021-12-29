import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, Guild } from "discord.js";
import { embed, ephemeralMessage, errorEmbed } from "../../util/Functions";

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

        const roles = this.arrayRoleIds(member.roles);

        roles.forEach(role => {
            if (!this.client.config.discord.roles.fixRoles.includes(role)) {
                roles.splice(roles.indexOf(role), 1);
            }
        });

        if (await this.mongo.getUserByDiscord(member.user.id)) {
            await this.mongo.deleteUserByDiscord(member.user.id);
        }

        await member.edit({
            roles: roles,
            nick: member.manageable ? null: undefined,
        }, `Unverified by ${interaction.user.tag}`);

        return interaction.editReply({
            embeds: [
                embed("Unverified!", `<@${member.user.id}> has been successfully unverified.`)
            ]
        })
    }
}