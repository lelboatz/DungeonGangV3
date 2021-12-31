import { DungeonGang } from "../../index";
import BaseCommand from "../BaseCommand";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember } from "discord.js";
import { embed, ephemeralMessage, errorEmbed, validUnicode } from "../../util/Functions";
import EmojiManager from "../../util/EmojiManager";

module.exports = class GiveCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "give",
            description: "Give an emote to someone.",
            category: "Emote",
            usage: "give <user> <emote>",
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("give")
                .setDescription("Give an emote to someone.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to give the emote to.")
                )
                .addStringOption(option => option
                    .setName("emote")
                    .setRequired(true)
                    .setDescription("The emote to give.")
                    .setAutocomplete(true)
                )
        })
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const userOption = interaction.options.getUser("user", true)
        const emote = interaction.options.getString("emote", true);

        if (!validUnicode(emote)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Please enter a valid emoji.`)
                ]
            })
        }

        const member = await this.fetchMember(userOption.id, interaction.guild!)

        if (!member) {
            return interaction.editReply({
                embeds: [
                    errorEmbed("That user is not in this server.")
                ]
            })
        }

        const user = await this.mongo.getUserByDiscord(userOption.id)

        if (!user) {
            return interaction.editReply({
                embeds: [
                    errorEmbed("That user is not verified. Please have them verify with /verify and try again.")
                ]
            })
        }


        const manager = new EmojiManager(member as GuildMember)

        await manager.update()
        await manager.sync()

        if (manager.user?.emotes.given.includes(emote)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`This user already owns that emote.`)
                ]
            })
        }

        await manager.giveEmote(emote)
        await manager.sync()

        return interaction.editReply({
            embeds: [
                embed("Success", `You gave ${member.toString()} the emote \`${emote}\``)
            ]
        })

    }
}