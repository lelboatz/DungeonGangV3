import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { ephemeralMessage, errorEmbed, bypassWords, starWord } from "../../util/Functions";
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

        let identifier = interaction.options.getString("identifier", true);

        const poll = await this.mongo.getPollByIdentifier(identifier) as unknown as MongoPoll;

        if (!poll) {

            for (let i = 0; i < bypassWords.length; i++) {
                if (identifier.includes(bypassWords[i])) {
                    identifier = starWord(identifier);
                }
            }

            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find a poll with the identifier \`${identifier}\`.`)
                ]
            })
        }

        if (poll.active) {
            if (interaction.user.permLevel < 1) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`You do not have permission to view this poll.`)
                    ]
                })
            } else {
                return interaction.editReply({
                    embeds: [
                        PollManager.pollInProgressEmbed(poll)
                    ]
                })
            }
        }

        return interaction.editReply({
            embeds: [
                PollManager.pollEndedEmbed(poll)
            ]
        })
    }
}