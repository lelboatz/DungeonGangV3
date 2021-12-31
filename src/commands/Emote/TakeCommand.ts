import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember } from "discord.js";
import { embed, ephemeralMessage, errorEmbed, validUnicode } from "../../util/Functions";
import EmojiManager from "../../util/EmojiManager";

module.exports = class TakeCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "take",
            description: "Takes an emote from a user.",
            category: "Emote",
            usage: "take <user> <emote>",
            enabled: true,
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("take")
                .setDescription("Takes an emote from a user.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to take the emote from.")
                )
                .addStringOption(option => option
                    .setName("emote")
                    .setRequired(true)
                    .setDescription("The emote to take.")
                    .setAutocomplete(true)
                )
        });
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

        if (manager.user?.emotes.given.includes(emote) === false) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`This user does not have that emote.`)
                ]
            })
        }

        await manager.takeEmote(emote)

        const equipped = manager.getSlotFromEmote(emote)

        if (equipped) {
            await manager.unequip(equipped)
        }

        await manager.sync()

        return interaction.editReply({
            embeds: [
                embed("Success", `You have taken the emote \`${emote}\` from ${member.toString()}.`)
            ]
        })
    }
}