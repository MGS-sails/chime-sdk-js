const https = require('https');
const { URL } = require('url');
const { v4: uuidv4 } = require('uuid');

exports.getMeeting = async function getMeeting(chimeMeetingInstance, meetingId) {
    try {
        return await chimeMeetingInstance.getMeeting({
            MeetingId: meetingId
        });
    } catch (error) {
        if (error.code === 'NotFound') {
            console.error('Meeting not found:', error.message);
          } else {
            console.error('Error retrieving meeting:', error);
          }
        return false
    }
}

exports.createMeeting = async function createMeeting(chimeMeetingInstance, meetingTitle) {
  let meetingOptions = {
    ClientRequestToken: uuidv4(),
    MediaRegion: 'us-east-1', // us-east-1 eu-west-1
    ExternalMeetingId: meetingTitle.substring(0, 64),
    MeetingFeatures: {
      Attendee: {
        MaxCount: 250
      },
      // Audio: {
      //   EchoReduction: "AVAILABLE",
      // },
      // Video: { 
      //   MaxResolution: 'FHD'
      // },
      // Content: {
      //   MaxResolution: 'UHD'
      // }
    }
  };

    try {
      console.log('creating meeting api.js')
        return await chimeMeetingInstance.createMeeting(meetingOptions)
    } catch (error) {
        console.log(error)
        return false
    }
}

exports.addAttendeeToMeeting = async function addAttendeeToMeeting(chimeMeetingInstance, meetingId, attendeeName) {
    let attendeeOption = { 
      MeetingId: meetingId,
      ExternalUserId: `${uuidv4().substring(0, 8)}#${attendeeName}`.substring(0, 64),
      Capabilities: { 
        Audio: "SendReceive",
        Video: "SendReceive",
        Content: "SendReceive"
      }
    }
    try {
        return await chimeMeetingInstance.createAttendee(attendeeOption)
    } catch (error) {
        console.log(error)
        return false
    }
}

exports.addAttendeesToMeeting = async function addAttendeesToMeeting(chimeMeetingInstance, meetingId, attendees) {
    let meeting_attendees = []

    const attendees_list = attendees.split(',');

    const batch_count = Math.ceil(attendees_list.length/100);
    
    for (let i = 0; i < batch_count; i++) {
      const attendees_slice = attendees_list.slice(i, 100)
      for (let j = 0; j < attendees_slice.length; j++) {
        meeting_attendees.push({
          ExternalUserId: `${uuidv4().substring(0, 8)}#${attendees_slice[j]}`.substring(0, 64),
          Capabilities: { 
            Audio: "SendReceive",
            Video: "SendReceive",
            Content: "Receive"
          },
        })
      }

      const meeting_data = {
        MeetingId: meetingId,
        Attendees: meeting_attendees
      }

      try {
        await chimeMeetingInstance.batchCreateAttendee(meeting_data)
      } catch (error) {
        console.log(error)
        return false
      }
    }

    return true;
    
}

exports.getMeetingAttendees = async function getMeetingAttendees(chimeMeetingInstance, meetingId) {
  try {
      return await chimeMeetingInstance.listAttendees({
        MeetingId: meetingId,
        NextToken: 2,
        MaxResults: 100
      })
  } catch (error) {
      console.log(error)
      return false
  }
}

exports.findAttendeeByExternalId = async function findAttendeeByExternalId(chimeMeetingInstance, meetingId, attendeeName) {
  try {
    for (let i = 0; i <= 250; i=+50) {
      const attendees = await chimeMeetingInstance.listAttendees({
        MeetingId: meetingId,
        NextToken: i+50,
        MaxResults: 100
      })

      if(!attendees.Attendees.length)
        return null

      const attendee = attendees.Attendees.find((a) => a.ExternalUserId === attendeeName);

      if(attendee)
        return attendee

      if(attendees.Attendees.length < 100)
        return null
    }

    return null
       
  } catch (error) {
      console.log(error)
      return false
  }
}

// **requires a separate npm aws chime package
exports.getMeetingByExternalId = async function getMeetingByExternalId(chimeMeetingInstance, externalMeetingId) {
  try {
      const meetings = await chimeMeetingInstance.listMeetings({ MaxResults: 10 }).promise();

      const meeting = meetings.Meetings.find((m) => m.ExternalMeetingId === externalMeetingId);

      return meeting ?? null
  } catch (error) {
      console.error('Error retrieving meeting:', error);

      return false
  }
}

exports.verifyUser = async function verifyUser(username) {
  try {
    return await sendHttpRequest({username: username})
  } catch (error) {
    console.error('Error verifying user:', error);
    return false
  }
    
}

function sendHttpRequest(url, method, data = null) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
        },
      };
  
      // Stringify data for POST/PUT requests
      const requestData = data ? JSON.stringify(data) : null;
      if (requestData) {
        options.headers['Content-Length'] = Buffer.byteLength(requestData);
      }
  
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
  
      const req = protocol.request(options, (res) => {
        let responseBody = '';
  
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
  
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(responseBody || '{}'),
            });
          } else {
            reject({
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(responseBody || '{}'),
            });
          }
        });
      });
  
      req.on('error', (error) => {
        reject(error);
      });
  
      // Write data for POST/PUT requests
      if (requestData) {
        req.write(requestData);
      }
  
      req.end();
    });
  }
