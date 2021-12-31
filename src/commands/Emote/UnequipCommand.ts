import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember } from "discord.js";
import { embed, ephemeralMessage, errorEmbed } from "../../util/Functions";
import EmojiManager from "../../util/EmojiManager";

module.exports = class UnequipCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "unequip",
            description: "Unequips an emote from a slot.",
            category: "Emote",
            usage: "unequip <slot>",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("unequip")
                .setDescription("Unequips an emote from a slot.")
                .addIntegerOption(option => option
                    .setName("slot")
                    .setDescription("The slot to unequip the emote from.")
                    .setRequired(true)
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const slot = interaction.options.getInteger("slot", true);

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

        if (!manager.getSlotName(slot)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`You do not have a slot with the number ${slot}.`)
                ]
            })
        }

        if (!manager.getEmojiInSlot(manager.getSlotName(slot)!)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`You do not have an emote in slot ${slot}.`)
                ]
            })
        }

        await manager.unequip(manager.getSlotName(slot)!)

        await manager.sync()

        return interaction.editReply({
            embeds: [
                embed("Unequipped", `You have unequipped the emote in slot ${slot}!`)
            ]
        })
    }
}