import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember } from "discord.js";
import { embed, ephemeralMessage, errorEmbed, validUnicode } from "../../util/Functions";
import EmojiManager from "../../util/EmojiManager";

module.exports = class EquipCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "equip",
            description: "Equips an emote in a slot.",
            category: "Emote",
            usage: "equip <emote> <slot>",
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("equip")
                .setDescription("Equips an emote in a slot.")
                .addStringOption(option => option
                    .setName("emote")
                    .setRequired(true)
                    .setDescription("The emote to equip.")
                    .setAutocomplete(true)
                )
                .addIntegerOption(option => option
                    .setName("slot")
                    .setRequired(true)
                    .setDescription("The slot to equip the emote in.")
                )

        });
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const emote = interaction.options.getString("emote", true)
        const slot = interaction.options.getInteger("slot", true)

        if (!validUnicode(emote)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Please enter a valid emoji.`)
                ]
            })
        }

        const user = await this.mongo.getUserByDiscord(interaction.user.id)

        if (!user) {
            return interaction.editReply({
                embeds: [
                    errorEmbed("You must be verified to use this command. Please verify with /verify and try again.")
                ]
            })
        }

        const manager = new EmojiManager(interaction.member as GuildMember)

        await manager.update()
        await manager.sync()

        if (!manager.emotes.includes(emote)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`You do not own the emote \`${emote}\`.`)
                ]
            })
        }

        if (manager.getSlotFromEmote(emote)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`You already have the emote \`${emote}\` equipped in slot \`${manager.getSlotIndex(manager.getSlotFromEmote(emote)!)}\`.`)
                ]
            })
        }

        if (!manager.getSlotName(slot)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`You do not have not unlocked Slot \`${slot}\`.`)
                ]
            })
        }

        manager.equip(manager.getSlotName(slot)!, emote)

        await manager.sync()

        return interaction.editReply({
            embeds: [
                embed("Equipped", `You equipped the emote \`${emote}\` in slot \`${slot}\`.`)
            ]
        })

    }
}