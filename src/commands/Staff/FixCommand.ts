import { DungeonGang } from "../../index";
import BaseCommand from "../BaseCommand";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, Guild } from "discord.js";
import { embed, ephemeralMessage, errorEmbed } from "../../util/Functions";

module.exports = class FixCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "fix",
            category: "Staff",
            description: "Fixes a user's roles.",
            usage: "fix <user>",
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("fix")
                .setDescription("Fixes a user's roles.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to fix.")
                )
        });
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
        let roles = this.arrayRoleIds(member.roles);

        roles = this.removeDuplicates(roles.concat(this.client.config.discord.roles.fixRoles))

        await member.edit({
            roles
        })
        return interaction.editReply({
            embeds: [
                embed("Success!", `<@${member.user.id}>'s roles have been fixed.`)
            ]
        })
    }
}