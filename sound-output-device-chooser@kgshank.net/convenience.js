/*******************************************************************************
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 * 
 * Orignal Author: Gopi Sankar Karmegam
 ******************************************************************************/

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;

/**
 * getSettings:
 * 
 * @schema: (optional): the GSettings schema id
 * 
 * Builds and return a GSettings schema for
 * @schema, using schema files in extensionsdir/schemas. If
 * @schema is not provided, it is taken from metadata['settings-schema'].
 */
function getSettings(schema) {
    let extension = ExtensionUtils.getCurrentExtension();

    schema = schema || extension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    // check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null))
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),GioSSS.get_default(),false);
    else
        schemaSource = GioSSS.get_default();

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error('Schema ' + schema + ' could not be found for extension '
                + extension.metadata.uuid + '. Please check your installation.');

    return new Gio.Settings({ settings_schema: schemaObj });
}

let cards;
function getProfiles(control, uidevice)
{
    let stream = control.lookup_stream_id(uidevice.get_stream_id());
    if(stream)
    {
        if(!cards[stream.card_index])
        {
            global.log(uidevice.port_name + ' not found'); 	    		
            refreshCards();
        }

        if(cards[stream.card_index])
        {
            global.log(uidevice.port_name + ' found');			
            return getProfilesForPort(uidevice.port_name, cards[stream.card_index]);
        } 	    		
    }
    else
    {
        /* Device is not active device, lets try match with port name */
        refreshCards();
        for each(let card in cards)
        {
            let profiles;			
            if((profiles = getProfilesForPort(uidevice.port_name, card)))
            {
                global.log("Found a name matching port "+ profiles.length);				
                return profiles;
            }
        }
    }

    return null;
}

function refreshCards()
{
    cards = {};	
    let [result, out, err, exit_code] = GLib.spawn_command_line_sync('pactl list cards');	
    if(result && !exit_code)
    {
        parseOutput(out);
    }
}

function parseOutput(out)
{
    let lines = out.toString().split('\n');
    let cardIndex;
    let parseSection = "CARDS";
    let port;
    let matches;
    while(lines.length > 0)
    {
        let line = lines.shift();

        if( (matches = /^Card\s#(\d+)$/.exec(line) )) {
            cardIndex = matches[1];
            global.log( "card_index=" + cardIndex);
        }
        else if (line.match(/^\t*Profiles:$/) )
        {
            parseSection = "PROFILES";
        }
        else if (line.match(/^\t*Ports:$/))
        {
            parseSection = "PORTS";
        }
        else
        {		
            switch(parseSection)
            {
                case "PROFILES":
                    if((matches = /(output:[^+]*?):\s(.*?)\s\(sinks:/.exec(line)))
                    {
                        if(!cards[cardIndex])
                        {
                            cards[cardIndex] = {'index':cardIndex,'profiles':[], 'ports':[]};
                        } 
                        cards[cardIndex].profiles.push({'name': matches[1], 'human_name': matches[2]});
                    }
                    break;
                case "PORTS":
                    if((matches = /\t*(.*?output.*?):\s(.*?)\s\(priority:/.exec(line)))
                    {
                        port = {'name' : matches[1], 'human_name' : matches[2]};
                    }
                    else if( port && (matches = /\t*Part of profile\(s\):\s(.*)/.exec(line)))
                    {
                        let profileStr = matches[1];
                        port.profiles = profileStr.split(', ');
                        cards[cardIndex].ports.push(port);
                        port = null;
                    }
                    break;
            }
        }		
    }
}

function getProfilesForPort(portName, card)
{
    for each(let port in card.ports)
    {
        if(portName === port.name)
        {
            global.log('Port Found!!!');
            let profiles = [];
            for each(let profile in port.profiles)
            {
                if(profile.indexOf('+input:') == -1)
                {
                    for each(let cardProfile in card.profiles)
                    {
                        if(profile === cardProfile.name)
                        {
                            profiles.push(cardProfile);							
                        }
                    }
                }
            }
            return profiles;
            break;
        }
    }
    return null;
}

