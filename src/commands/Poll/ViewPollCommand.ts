import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { ephemeralMessage, errorEmbed } from "../../util/Functions";
import PollManager from "../../util/PollManager";
import { MongoPoll } from "../../util/Mongo";

module.exports = class ViewPollCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "viewpoll",
            description: "View a poll by its identifier.",
            category: "Poll",
            usage: "viewpoll <poll identifier>",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("viewpoll")
                .setDescription("View a poll by its identifier.")
                .addStringOption(option => option
                    .setName("identifier")
                    .setRequired(true)
                    .setDescription("The poll identifier to view.")
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const identifier = interaction.options.getString("identifier", true);

        const poll = await this.mongo.getPollByIdentifier(identifier)

        if (!poll) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find a poll with the identifier \`${identifier}\`.`)
                ]
            })
        }
        return interaction.editReply({
            embeds: [
                PollManager.pollEndedEmbed(poll as unknown as MongoPoll) as unknown as MessageEmbed
            ]
        })
    }
}