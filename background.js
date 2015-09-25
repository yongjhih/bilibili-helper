var notification = false,
	playerTabs = {},
	cidHackType = {};

function getFileData(url, callback) {
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", url, true);
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			if (typeof callback == "function") callback(xmlhttp.responseText);
		}
	}
	xmlhttp.send();
}

function getUrlOnReady(url) {
	return new Promise(function (resolve, reject) {
		var req = new XMLHttpRequest();
		req.open('GET', url, true);
		req.onreadystatechange = function () {
			if (req.readyState === 4 && req.status === 200) {
				resolve(req.responseText);
			}
		};
		req.onerror = function () {
			reject(new Error(req.statusText));
		};
		req.send();
	});
}

function getUrl(url) {
	return new Promise(function (resolve, reject) {
		var request = new XMLHttpRequest();
		request.open('GET', url, true);
		request.onload = function () {
			if (request.status === 200) {
				resolve(request.responseText);
			} else {
				reject(new Error(request.statusText));
			}
		};
		request.onerror = function () {
			reject(new Error(request.statusText));
		};
		request.send();
	});
}

function postUrlOnReady(url, data) {
	return postUrlWithEncodedDataOnReady(url, null);
}

function postUrlWithEncodedDataOnReady(url, data) {
	return new Promise(function (resolve, reject) {
		request = new XMLHttpRequest();
		request.open("POST", url, true);
		request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				resolve(request.responseText);
			} else {
				reject(new Error(request.statusText));
			}
		}
		request.onerror = function () {
			reject(new Error(request.statusText));
		};
		if (data != null) request.send(data);
		else request.send();
	});
}

function postUrlWithDataOnReady(url, data) {
	var encodedData = "", append = false;

	Object.keys(data).forEach(function(key) {
		if (!append) {
			append = true;
		} else {
			encodedData += "&";
		}
		encodedData += encodeURIComponent(key).replace(/%20/g, "+") + "=" +
			encodeURIComponent(data[key]).replace(/%20/g, "+");
	});

	return postUrlWithEncodedDataOnReady(url, encodedData);
}

function postFileData(url, data, callback) {
	var encodeData = "", append = false;
	Object.keys(data).forEach(function(key) {
		if (!append) {
			append = true;
		} else {
			encodeData += "&";
		}
		encodeData += encodeURIComponent(key).replace(/%20/g, "+") + "=" +
			encodeURIComponent(data[key]).replace(/%20/g, "+");
	});
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", url, true);
	xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			if (typeof callback == "function") callback(xmlhttp.responseText);
		}
	}
	xmlhttp.send(encodeData);
}

function getUrlVars(url) {
	var vars = [],
		hash;
	var hashes = url.slice(url.indexOf('?') + 1).split('&');
	for (var i = 0; i < hashes.length; i++) {
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		vars[hash[0]] = hash[1];
	}
	return vars;
}

function searchBilibili(info) {
	chrome.tabs.create({
		url: "http://www.bilibili.com/search?keyword=" + info.selectionText
	});
}

function notifyAllTabs(message) {
	chrome.windows.getAll({
		populate: true
	}, function(wins) {
		wins.forEach(function(win) {
			win.tabs.forEach(function(tab) {
				chrome.tabs.sendMessage(tab.id, message);
			});
		});
	});
}

function setIcon() {
	chrome.browserAction.setIcon({
		path: "imgs/icon-19.png"
	});
}

function updateAll() {
	notifyAllTabs({
		command: "update"
	});
	setIcon();
}

function enableAll() {
	setOption("enabled", true);
	updateAll();
}

function disableAll() {
	setOption("enabled", false);
	updateAll();
}

function checkDynamic() {
	chrome.cookies.get({
		url: "http://interface.bilibili.com/nav.js",
		name: "DedeUserID"
	}, function(cookie) {
		if (cookie === null) return false;
		else if (getOption("dynamic") == "on") {
			getUrlOnReady("http://interface.bilibili.com/nav.js").then(function(data) {
				chrome.cookies.get({
					url: "http://interface.bilibili.com/nav.js",
					name: "_cnt_dyn"
				}, function(cookie) {
					if (typeof cookie !== "undefined") {
						if (cookie.value > getOption("updates")) {
							if (notification) chrome.notifications.clear("bh-" + notification, function() {});
							notification = (new Date()).getTime();
							chrome.notifications.create("bh-" + notification, {
								type: "basic",
								iconUrl: "imgs/icon-32.png",
								title: chrome.i18n.getMessage('noticeficationTitle'),
								message: chrome.i18n.getMessage('followingUpdateMessage').replace('%n', cookie.value),
								isClickable: false
							}, function() {})
						}
						setOption("updates", cookie.value);
						if (getOption("updates") == 0) {
							chrome.browserAction.setBadgeText({
								text: ""
							});
						} else {
							chrome.browserAction.setBadgeText({
								text: getOption("updates")
							});
						}
					}
				});
			});
		}
	});
}

function getCid(avid) {
	if (typeof cidCache[avid] != "undefined") {
		return Promise.resolve(cidCache[avid]);
	}

	return getUrlOnReady("http://api.bilibili.com/view?type=json&appkey=95acd7f6cc3392f3&id=" + avid + "&page=1").then(function(avInfo) {
		avInfo = JSON.parse(avInfo);
		if (typeof avInfo.code != "undefined" && avInfo.code == -503) {
			return Promise.reject(new Error(avid));
		} else {
			if (typeof avInfo.cid == "number") {
				cidCache[avid] = avInfo.cid;
				localStorage.setItem("cidCache", JSON.stringify(cidCache));
			}
			return avInfo.cid;
		}
	}, function(error) {
		var promise = new Promise();
		setTimeout(function() {
			getCid(error.message).then(function(cid) {
				promise.resolve(cid);
			});
		}, 1000);
		return promise;
	});
}

/*
listenerPromise(promise, response) {
	promise.then(function(it) {
		if (it != null) response(it);
		else response();
	});
}
*/

chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
	switch (request.command) {
		case "init":
			sendResponse({
				replace: getOption("replace"),
				html5: getOption("html5"),
				version: version,
				playerConfig: JSON.parse(getOption("playerConfig"))
			});
			return true;
		case "cidHack":
			playerTabs[sender.tab.id] = request.cid;
			cidHackType[request.cid] = request.type;
			sendResponse();
			return true;
		case "getOption":
			sendResponse({
				value: getOption(request.key)
			});
			return true;
		case "enableAll":
			enableAll();
			sendResponse({
				result: "ok"
			});
			return true;
		case "disableAll":
			disableAll();
			sendResponse({
				result: "ok"
			});
			return true;
		case "getCSS":
			if (getOption("enabled") == "true" || getOption("ad") != "keep") sendResponse({
				result: "ok",
				css: getCSS(request.url)
			});
			else sendResponse({
				result: "disabled"
			});
			return true;
		case "getVideoInfo":
			getUrlOnReady("http://api.bilibili.com/view?type=json&appkey=95acd7f6cc3392f3&id=" + request.avid + "&page=" + request.pg).then(function(avInfo) {
				avInfo = JSON.parse(avInfo);
				sendResponse({
					videoInfo: avInfo
				});
			});
			return true;
		case "getDownloadLink":
			var url = {
				download: "http://interface.bilibili.com/playurl?platform=bilihelper&otype=json&appkey=95acd7f6cc3392f3&cid=" + request.cid + "&quality=4&type=" + getOption("dlquality"),
				playback: "http://interface.bilibili.com/playurl?platform=bilihelper&otype=json&appkey=95acd7f6cc3392f3&cid=" + request.cid + "&quality=4&type=mp4"
			}
			if (request.cidHack == 2) {
				var url = {
					download: "https://bilibili.guguke.net/playurl.json?cid=" + request.cid + "&type=" + getOption("dlquality"),
					playback: "https://bilibili.guguke.net/playurl.json?cid=" + request.cid + "&type=mp4"
				}
			}
			getUrlOnReady(url["download"]).then(function(avDownloadLink) {
				avDownloadLink = JSON.parse(avDownloadLink);
				if (getOption("dlquality") == 'mp4') {
					return {
						download: avDownloadLink,
						playback: avDownloadLink,
						dlquality: getOption("dlquality"),
						rel_search: getOption("rel_search")
					};
				} else {
					return getUrlOnReady(url["playback"]).then(function(avPlaybackLink) {
						avPlaybackLink = JSON.parse(avPlaybackLink);
						return {
							download: avDownloadLink,
							playback: avPlaybackLink,
							dlquality: getOption("dlquality"),
							rel_search: getOption("rel_search")
						};
					});
				}
			}).then(function(it) {
				sendResponse(it);
			});
			return true;
		case "getMyInfo":
			getUrlOnReady("http://api.bilibili.com/myinfo").then(function(myinfo) {
				myinfo = JSON.parse(myinfo);
				if (typeof myinfo.code == undefined) myinfo.code = 200;
				sendResponse({
					code: myinfo.code || 200,
					myinfo: myinfo
				});
			});
			return true;
		case "searchVideo":
			var keyword = request.keyword;
			getUrlOnReady("http://api.bilibili.com/search?type=json&appkey=95acd7f6cc3392f3&keyword=" + encodeURIComponent(keyword) + "&page=1&order=ranklevel").then(function(searchResult) {
				searchResult = JSON.parse(searchResult);
				if (searchResult.code == 0) {
					sendResponse({
						status: "ok",
						result: searchResult.result[0]
					});
				} else {
					sendResponse({
						status: "error",
						code: searchResult.code,
						error: searchResult.error
					});
				}
			});
			return true;
		case "checkComment":
			getUrlOnReady("http://www.bilibili.com/feedback/arc-" + request.avid + "-1.html").then(function(commentData) {
				var test = commentData.indexOf('<div class="no_more">');
				if (test >= 0) {
					sendResponse({
						banned: true
					});
				} else {
					sendResponse({
						banned: false
					});
				}
			});
			return true;
		case "savePlayerConfig":
			sendResponse({
				result: setOption("playerConfig", JSON.stringify(request.config))
			});
			return true;
		case "sendComment":
			var errorCode = ["正常", "选择的弹幕模式错误", "用户被禁止", "系统禁止",
			"投稿不存在", "UP主禁止", "权限有误", "视频未审核/未发布", "禁止游客弹幕"];
			request.comment.cid = request.cid;
			postUrlWithDataOnReady("http://interface.bilibili.com/dmpost?cid=" + request.cid +
				"&aid=" + request.avid + "&pid=" + request.page, request.comment).then(function(result) {
				result = parseInt(result);
				if (result < 0) {
					sendResponse({
						result: false,
						error: errorCode[-result]
					});
				} else {
					sendResponse({
						result: true,
						id: result
					});
				}
			});
			return true;
		default:
			sendResponse({
				result: "unknown"
			});
			return false;
	}
});

if (localStorage.getItem("enabled") == null) {
	enableAll();
}

if (getOption("contextmenu") == "on") {
	chrome.contextMenus.create({
		title: chrome.i18n.getMessage('searchBili'),
		contexts: ["selection"],
		onclick: searchBilibili
	});
}

setIcon();

checkDynamic();

chrome.alarms.create("checkDynamic", {
	periodInMinutes: 5
});

if (getOption("version") < chrome.app.getDetails().version) {
	setOption("version", chrome.app.getDetails().version);
	chrome.tabs.create({
		url: chrome.extension.getURL('options.html#update')
	});
}

chrome.alarms.onAlarm.addListener(function(alarm) {
	switch (alarm.name) {
		case "checkDynamic":
			checkDynamic();
			return true;
		default:
			return false;
	}
});

chrome.webRequest.onBeforeRequest.addListener(function(details) {
	chrome.tabs.sendMessage(details.tabId, {
		command: "error"
	});
}, {
	urls: ["http://comment.bilibili.com/1272.xml"]
});

chrome.webRequest.onHeadersReceived.addListener(function(details) {
	var blockingResponse = {};
	if (getOption("replace") == "on") {
		if (details.url.indexOf('retry=1') < 0) {
			blockingResponse.redirectUrl = details.url + '&retry=1';
		}
	}
	return blockingResponse;
}, {
	urls: ["http://g3.letv.cn/vod/v2/*"]
}, ["blocking"]);

chrome.webRequest.onHeadersReceived.addListener(function(details) {
	var blockingResponse = {};
	if (getOption("replace") == "on" && details.url.indexOf("cid=" + playerTabs[details.tabId]) > 0) {
		playerTabs[details.tabId] = false;
		var params = getUrlVars(details.url);
		if (params['cid']) {
			if (cidHackType[params['cid']] == 1) {
				blockingResponse.redirectUrl = 'http://interface.bilibili.com/playurl?platform=bilihelper&cid=' + params['cid'] + '&appkey=95acd7f6cc3392f3';
			} else if (cidHackType[params['cid']] == 2) {
				blockingResponse.redirectUrl = 'https://bilibili.guguke.net/playurl.xml?cid=' + params['cid'];
			}
		}
	}
	return blockingResponse;
}, {
	urls: ["http://interface.bilibili.com/playurl?cid*", "http://interface.bilibili.com/playurl?accel=1&cid=*"]
}, ["blocking"]);

chrome.webRequest.onHeadersReceived.addListener(function(details) {
	var headers = details.responseHeaders,
		blockingResponse = {};
	if (details.statusLine == "HTTP/1.1 302 Moved Temporarily" && getOption("replace") == "on") {
		blockingResponse.responseHeaders = [];
		var redirectUrl = "";
		for (i in headers) {
			if (headers[i].name.toLowerCase() != "location") {
				blockingResponse.responseHeaders.push(headers[i]);
			} else {
				redirectUrl = headers[i]["value"];
			}
		}
		blockingResponse.responseHeaders.push({
			name: "Set-Cookie",
			value: "redirectUrl=" + encodeURIComponent(redirectUrl)
		})
	} else {
		blockingResponse.responseHeaders = headers;
	}
	return blockingResponse;
}, {
	urls: ["http://www.bilibili.com/video/av*"]
}, ["responseHeaders", "blocking"]);
