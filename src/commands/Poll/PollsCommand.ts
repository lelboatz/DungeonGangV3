import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, MessageActionRow, MessageSelectMenu } from "discord.js";
import { ephemeralMessage, errorEmbed, getMojang, bypassWords, starWord } from "../../util/Functions";
import { MongoPoll } from "../../util/Mongo";
import PollManager from "../../util/PollManager";

module.exports = class PollsCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "polls",
            description: "View all non-active polls for a user.",
            category: "Poll",
            usage: "polls <username>",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("polls")
                .setDescription("View all non-active polls for a user.")
                .addStringOption(option => option
                    .setName("username")
                    .setRequired(true)
                    .setDescription("The username of the user to view polls for.")
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        let username = interaction.options.getString("username", true);

        const mojang = await getMojang(username)

        if (mojang === "error" || !mojang) {

            for (let i = 0; i < bypassWords.length; i++) {
                if (username.includes(bypassWords[i])) {
                    username = starWord(username);
                }
            }

            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find user \`${username}\`.`)
                ]
            })
        }

        let polls = await this.mongo.get25Polls(mojang.id) as unknown as MongoPoll[]

        if (!polls || polls.length === 0) {

            for (let i = 0; i < bypassWords.length; i++) {
                if (username.includes(bypassWords[i])) {
                    username = starWord(username);
                }
            }

            return interaction.editReply({
                embeds: [
                    errorEmbed(`No polls found for user \`${username}\`.`)
                ]
            })
        }

        let menu = new MessageSelectMenu()
            .setCustomId("POLLS_COMMAND_MENU_" + interaction.user.id);

        menu.addOptions([{
            label: polls[0].identifier ?? polls[0].username,
            value: polls[0]._id,
            emoji: "📊",
            default: true
        }])

        if (polls.slice(1).length > 0) {
            menu = menu
                .addOptions(polls.slice(1).map(poll => ({
                    label: poll.identifier ?? poll.username,
                    value: poll._id,
                    emoji: "📊"
                })))
        }

        return interaction.editReply({
            embeds: [
                PollManager.pollEndedEmbed(polls[0])
            ],
            components: [
                new MessageActionRow()
                    .addComponents([
                        menu
                    ])
            ]
        })
    }
}