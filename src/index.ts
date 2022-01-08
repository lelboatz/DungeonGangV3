import config from "./data/config.json";
import { promisify } from "util";
import {
    Client,
    ClientOptions,
    Collection, GuildMember,
    GuildMemberRoleManager,
    Interaction,
    Permissions,
    Snowflake
} from "discord.js";
import fs, { PathLike } from "fs";
import path from "path";
import klaw from "klaw";
import Mongo from "./util/Mongo"
import { Client as HypixelClient } from "@zikeji/hypixel"
import axios from "axios";
__dirname = path.resolve();

export interface DungeonGang extends Client {
    commands: Collection<any, any>;
    slashCommands: any[]
    owners: Snowflake[]
    mongo: Mongo;
    hypixel: HypixelClient;
    wait(ms: number): Promise<void>;
}

declare module "discord.js" {
    interface User {
        permLevel: 4 | 3 | 2 | 1 | 0;
    }
    interface Message {
        args: string[];
    }
}

export class DungeonGang extends Client {
    constructor(options: ClientOptions) {
        super(options);
        this.commands = new Collection();
        this.slashCommands = [];
        this.wait = promisify(setTimeout);
        this.mongo = new Mongo(this);
        this.owners = this.config.discord.botAdmin as Snowflake[]
        this.hypixel = new HypixelClient(this.config.minecraft.apiKey);
    }

    getPermissionLevel(member: GuildMember | undefined | null) {
        // if (this.owners.includes(member.user.id)) return 4;
        if (!member) return 0;
        const roles = member.roles as GuildMemberRoleManager
        const permissions = member.permissions as Readonly<Permissions>
        // if (roles.cache.has(this.config.discord.roles.staff.owner.id) || roles.cache.has(this.config.discord.roles.staff.coOwner.id)) return 3;
        if (roles.cache.has(this.config.discord.roles.staff.managerRole) || permissions.has(["ADMINISTRATOR"])) return 2;
        if (roles.cache.has(this.config.discord.roles.staff.staffRole)) return 1;
        return 0;
    }

    loadCommand(commandPath: PathLike, commandName: string) {
        try {
            const props = new (require(`${commandPath}${path.sep}${commandName}`))(this);
            props.conf.location = commandPath;
            if (props.init) {
                props.init(this);
            }
            this.commands.set(props.help.name, props);
            console.log(`Loading Global Command: ${props.help.name}. 👌`)
            this.slashCommands.push(props.conf.slashCommandBody.toJSON())
            if (props.conf.messageContextMenuCommandBody) {
                this.slashCommands.push(props.conf.messageContextMenuCommandBody.toJSON())
            }
            if (props.conf.userContextMenuCommandBody) {
                this.slashCommands.push(props.conf.userContextMenuCommandBody.toJSON())
            }
            return false;
        } catch (e) {
            return `Unable to load command ${commandName}: ${e}`;
        }
    }

    async refreshKey() {
        this.hypixel = new HypixelClient(this.config.minecraft.apiKey);
    }

    get config(): typeof config {
        return JSON.parse(fs.readFileSync("src/data/config.json").toString());
    }

    set config(value: typeof config) {
        fs.writeFileSync("src/data/config.json", JSON.stringify(value, null, 2));
    }
}

export const client = new DungeonGang({
    intents: [
        "GUILDS",
        "GUILD_MEMBERS",
    ],
    partials: ["MESSAGE", "GUILD_MEMBER"],
    allowedMentions: { parse: ["users"] },
});

const init = async () => {
    klaw("./build/commands").on("data", item => {
        const cmdFile = path.parse(item.path);
        if (!cmdFile.ext || cmdFile.ext !== ".js" || cmdFile.name === "BaseCommand") return;
        const response = client.loadCommand(cmdFile.dir, `${cmdFile.name}${cmdFile.ext}`);
        if (response) console.error(response);
    });
    const evtFiles = fs.readdirSync("./build/events/");
    console.log(`Loading a total of ${evtFiles.length} events.`);
    evtFiles.forEach(file => {
        const eventName = file.split(".")[0];
        console.log(`Loading Event: ${eventName}`);
        const event = new (require(`./events/${file}`))(client);
        client.on(eventName, (...args) => event.run(...args));
        delete require.cache[require.resolve(`./events/${file}`)]
    })
    await client.mongo.connect()
    await client.login(client.config.discord.token);

    const url = `https://discord.com/api/v9/applications/${client.user?.id}/guilds/${client.config.discord.guildId}/commands`
    await axios.put(url, JSON.stringify(client.slashCommands), {
        headers: {
            "Authorization": "Bot " + client.config.discord.token,
            "Content-Type": "application/json"
        }
    })

}

init().catch(console.error);