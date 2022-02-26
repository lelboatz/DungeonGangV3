import BaseCommand from "../../BaseCommand";
import { DungeonGang } from "../../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction } from "discord.js";
import { Punishment } from "../../../util/Mongo";

module.exports = class PunishCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "punish",
            description: "Punishes a user.",
            category: "Staff",
            usage: "punish <user> <reason> <short description>",
            guildOnly: true,
            permLevel: 1,
            slashCommandBody: new SlashCommandBuilder()
                .setName("punish")
                .setDescription("Punishes a user.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to punish.")
                )
                .addStringOption(option => option
                    .setName("reason")
                    .setRequired(true)
                    .setDescription("The reason for the punishment.")
                    .addChoices(client.config.punishments.map(punishment => [punishment.reason, punishment.id]))
                )
                .addStringOption(option => option
                    .setName("short_description")
                    .setRequired(false)
                    .setDescription("A short description of the offense.")
                )
                .addStringOption(option => option
                    .setName("severity")
                    .setDescription("The severity of the punishment (only use with other punishment reason)")
                    .setRequired(false)
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        const user = interaction.options.getUser("user", true);
        const punishmentId = interaction.options.getString("reason", true);
        const shortDescription = interaction.options.getString("short_description");
        const severity = interaction.options.getInteger("severity");
        const punishments = this.client.config.punishments;
        const punishment = punishments[punishments.findIndex(punishment => punishment.id === punishmentId)]

        let basePunishment = "WARN";
        let punishmentLength = 0;
        let punishmentPoints = 0;

        switch (punishment.severity) {
            case 2:
            case 3:
            case 4:
                basePunishment = "MUTE"
                break;
            case 5:
                basePunishment = "PERM_BAN"
                break;
        }

        const member = await this.fetchMember(user.id, interaction.guild!)

        if (!member) {
            return
        }

        const history = await this.mongo.getPunishmentHistory(member.id);

        if (!history) {
            return
        }

        let punishmentsBySeverity: Punishment[][] = [];

        for (const punishment of history) {
            if (punishmentsBySeverity[punishment.severity]) {
                punishmentsBySeverity[punishment.severity].push(punishment);
            } else {
                punishmentsBySeverity[punishment.severity] = [punishment];
            }
        }

        punishmentsBySeverity.forEach((punishments, index) => {
            let pointsToAdd = (index * punishments.length) + punishments.length;
            if (punishment.severity === index) {
                pointsToAdd *= 3;
            }
            punishmentPoints += pointsToAdd;
        })

        if (punishmentPoints > 10) {
            basePunishment = "MUTE"
        }

        if (punishmentPoints > 50) {
            basePunishment = "TEMP_BAN"
        }

        if (punishmentPoints > 100 || severity === 5 || punishment.severity === 5) {
            basePunishment = "PERM_BAN"
        }

        let punishmentDuration = (Math.pow(1.25, punishmentPoints) * 15000) + ((punishment.severity * 400000) * punishmentPoints) + (punishmentPoints * 250000);



    }

}