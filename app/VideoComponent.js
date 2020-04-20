import React, { Component } from 'react';
import { connect, createLocalTracks } from 'twilio-video';
import axios from 'axios';
import RaisedButton from 'material-ui/RaisedButton';
import { Card, CardHeader, CardText } from 'material-ui/Card';

const roomName = 'test';

export default class VideoComponent extends Component {
	constructor(props) {
		super();
		this.state = {
			isPerformer: false,
			identity: null,
			roomName: roomName,
			previewTracks: null,
			localMediaAvailable: false,
			hasJoinedRoom: false,
			activeRoom: '' // Track the current active room
		};

		this.joinPerformer = this.joinPerformer.bind(this);
		this.joinAudience = this.joinAudience.bind(this);
		this.joinRoom = this.joinRoom.bind(this);
		this.handleRoomNameChange = this.handleRoomNameChange.bind(this);
		this.roomJoined = this.roomJoined.bind(this);
		this.leaveRoom = this.leaveRoom.bind(this);
		this.detachTracks = this.detachTracks.bind(this);
		this.detachParticipantTracks = this.detachParticipantTracks.bind(this);
	}

	handleRoomNameChange(e) {
		let roomName = e.target.value;
		this.setState({ roomName });
	}

	joinPerformer() {
		this.setState({ isPerformer : true });

		const constraints = {
			audio: {
				echoCancellation: false,
				autoGainControl: false,
				noiseSuppression: false,
				latency: 0,
				sampleRate: 44100,
				sampleSize: 16
			},
			video: {
				facingMode: "user",
				width: {
					min: 720,
					ideal: 1920,
					max: 1920
				},
				height: {
					min: 480,
					ideal: 1080,
					max: 1080
				},
				aspectRatio: 1.777777778,
				frameRate: { max: 30 }
			}
		};

		axios.get('/performer').then(results => {
			const { identity, token } = results.data;
			this.setState({ identity, token });
			this.joinRoom(1280);
		});
	}

	joinAudience() {
		const constraints = {
			audio: {
				echoCancellation: false,
				autoGainControl: false,
				noiseSuppression: false,
				sampleRate: 44100,
				sampleSize: 16
			},
			video: {
				facingMode: "user",
				width: {
					min: 160,
					ideal: 320,
					max: 320
				},
				height: {
					min: 120,
					ideal: 240,
					max: 240
				},
				frameRate: { max: 15 }
			}
		};

		axios.get('/audience').then(results => {
			const { identity, token } = results.data;
			this.setState({ identity, token });
			this.joinRoom(320);
		});
	}


	joinRoom(width) {
		// let localStream = null;

		// navigator.mediaDevices.getUserMedia(constraints).then(stream => {
		// 	const AudioContext = window.AudioContext || window.webkitAudioContext;
		// 	const context = new AudioContext();
		// 	const audioStream = stream.getAudioTracks()[0];
		// 	const source = context.createMediaStreamSource(stream);
		// 	const destination = context.createMediaStreamDestination();
		// 	const gainNode = context.createGain();
		// 	gainNode.gain.setValueAtTime(1, context.currentTime);
		// 	source.connect(gainNode);
		// 	gainNode.connect(destination);
		// 	stream.removeTrack(audioStream);
		// 	stream.addTrack(destination.stream.getAudioTracks()[0]);
			
		// 	localStream = stream;
		// });


			// Join the Room with the token from the server and the
			// LocalParticipant's Tracks.
			createLocalTracks({
				audio: {
					echoCancellation: false,
					autoGainControl: false,
					noiseSuppression: false,
					sampleRate: 44100,
					sampleSize: 16
				},
				video: { width: width },			
			}).then(localTracks => {
				return connect(this.state.token, {
					name: this.state.roomName,
					tracks: localTracks
				});
			}).then(this.roomJoined, error => {
				alert('Could not connect to Twilio: ' + error.message);
			});

	}

	attachTracks(tracks, container) {
		tracks.forEach(track => {
			if(track.kind == 'audio') {
				console.log(track.mediaStreamTrack.getSettings());
			}
			container.appendChild(track.attach());
		});
	}

	// Attaches a track to a specified DOM container
	attachParticipantTracks(participant, container) {
		var tracks = Array.from(participant.tracks.values());
		this.attachTracks(tracks, container);
	}

	detachTracks(tracks) {
		tracks.forEach(track => {
			track.detach().forEach(detachedElement => {
				detachedElement.remove();
			});
		});
	}

	detachParticipantTracks(participant) {
		var tracks = Array.from(participant.tracks.values());
		this.detachTracks(tracks);
	}

	roomJoined(room) {
		// Called when a participant joins a room
		console.log("Joined as '" + this.state.identity + "'");
		this.setState({
			activeRoom: room,
			localMediaAvailable: true,
			hasJoinedRoom: true
		});

		// Attach LocalParticipant's Tracks, if not already attached.
		var previewContainer = this.refs.localMedia;
		if (!previewContainer.querySelector('video')) {
			this.attachParticipantTracks(room.localParticipant, previewContainer);
		}

		// Attach the Tracks of the Room's Participants.
		room.participants.forEach(participant => {
			console.log(participant);
			console.log("Already in Room: '" + participant.identity + "'");
			var previewContainer = this.refs.remoteMedia;
			this.attachParticipantTracks(participant, previewContainer);
		});

		// When a Participant joins the Room, log the event.
		room.on('participantConnected', participant => {
			console.log("Joining: '" + participant.identity + "'");
		});

		// When a Participant adds a Track, attach it to the DOM.
		room.on('trackAdded', (track, participant) => {
			console.log(participant.identity + ' added track: ' + track.kind);

			const performer = participant.identity.search('performer');
			let previewContainer;

			if(performer == -1) {
				previewContainer = this.refs.remoteMedia;
			} else {
				previewContainer = this.refs.performer;
			}

			this.attachTracks([track], previewContainer);
		});

		// When a Participant removes a Track, detach it from the DOM.
		room.on('trackRemoved', (track, participant) => {
			console.log(participant.identity + ' removed track: ' + track.kind);
			this.detachTracks([track]);
		});

		// When a Participant leaves the Room, detach its Tracks.
		room.on('participantDisconnected', participant => {
			console.log("Participant '" + participant.identity + "' left the room");
			this.detachParticipantTracks(participant);
		});

		// Once the LocalParticipant leaves the room, detach the Tracks
		// of all Participants, including that of the LocalParticipant.
		room.on('disconnected', () => {
			if (this.state.previewTracks) {
				this.state.previewTracks.forEach(track => {
					track.stop();
				});
			}
			this.detachParticipantTracks(room.localParticipant);
			room.participants.forEach(this.detachParticipantTracks);
			this.state.activeRoom = null;
			this.setState({ hasJoinedRoom: false, localMediaAvailable: false });
		});
	}

	componentDidMount() {
		// axios.get('/token').then(results => {
		// 	const { identity, token } = results.data;
		// 	this.setState({ identity, token });
		// });
	}

	leaveRoom() {
		this.state.activeRoom.disconnect();
		this.setState({ hasJoinedRoom: false, localMediaAvailable: false });
	}

	render() {
		// Hide 'Join Room' button if user has already joined a room.
		let joinOrLeaveRoomButton = this.state.hasJoinedRoom ? (
			<RaisedButton label="Leave Room" secondary={true} onClick={this.leaveRoom} />
		) : (
			<RaisedButton label="Join Room" primary={true} onClick={this.joinRoom} />
		);

		return (
			<Card>
				<CardText>
					<div>
						<div>
							<RaisedButton label="Join as Performer" primary={true} onClick={this.joinPerformer} />
							<RaisedButton label="Join as Audience" primary={true} onClick={this.joinAudience} />
						</div>

						<div id="performer" ref="performer">
							{this.state.isPerformer ? <div ref="localMedia"></div> : ''}
						</div>

						<div id="audience">
							{this.state.isPerformer ? '' : <div ref="localMedia" id="audience-media"></div>}
							<div ref="remoteMedia" id="audience-media"></div>
						</div>
					</div>
				</CardText>
			</Card>
		);
	}
}
