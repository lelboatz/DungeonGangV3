import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import PollManager from "../../util/PollManager";
import { embed, ephemeralMessage, errorEmbed } from "../../util/Functions";

module.exports = class PollCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "poll",
            description: "Creates a poll for a user.",
            category: "Poll",
            usage: "poll <username>",
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("poll")
                .setDescription("Creates a poll for a user.")
                .addStringOption(option => option
                    .setName("username")
                    .setRequired(true)
                    .setDescription("The username of the user to poll.")
                )
        })
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const response = await PollManager.create(interaction.options.getString("username", true));

        if (response.success) {
            return interaction.editReply({
                embeds: [
                    embed("Poll Created!", response.message)
                ]
            })
        } else {
            return interaction.editReply({
                embeds: [
                    errorEmbed(response.message)
                ]
            })
        }
    }
}