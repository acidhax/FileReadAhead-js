// Why? To keep a local buffer full at all times. This keeps network
// latency down for on-demand streaming over a NAS
var FileReadAhead = function (file, bufferSize) {
	this.file = file;
	this.size = this.file.size;
	this.type = this.file.type;
	this.bufferSize = bufferSize || 1024 * 1024 * 75; // 75mb default

	this.reload();
};

FileReadAhead.prototype.reload = function() {
	this.cachedChunk = this.file.slice(0,this.bufferSize);
	this.filePosition = this.bufferSize;
};

FileReadAhead.prototype.getStartPosition = function() {
	return this.filePosition - this.cachedChunk.size;
};

FileReadAhead.prototype.getEndPosition = function() {
	return this.filePosition;
};

FileReadAhead.prototype.isTriggering = function(start, end) {
	if (this.cachedChunk.size <= this.bufferSize / 2) {
		return true;
	}
	return false;
};

FileReadAhead.prototype.clip = function(start) {
	var difference = start - this.getStartPosition();
	if (difference >= 1024*1024) {
		console.log("CLIPPING CACHE", difference);
		this.cachedChunk = this.cachedChunk.slice(difference - 1024*1024);
	}
};

FileReadAhead.prototype.check = function(end) {
	if (this.isTriggering()) {
		this.cachedChunk = new Blob([this.cachedChunk, this.file.slice(this.getEndPosition(), this.getEndPosition() + this.bufferSize)]);
		this.filePosition += this.bufferSize;
	}
};

FileReadAhead.prototype.normalizePosition = function(position) {
	// getStartPosition() == position 0;
	// getEndPosition() == last position
	if (position < this.getStartPosition() || position > this.getEndPosition()) {
		return -1;
	}
	return position - this.getStartPosition();
};

FileReadAhead.prototype.slice = function(start, end) {
	var self = this;
	if (start >= this.getStartPosition() && end > this.getEndPosition()) {
		this.cachedChunk = new Blob([this.cachedChunk, this.file.slice(this.getEndPosition(), this.getEndPosition() + this.bufferSize)]);		
		this.filePosition += this.bufferSize;
		return this.slice(start, end);
	}
	if (start < this.getStartPosition() || end > this.getEndPosition()) {
		console.log(start, this.getStartPosition(), start < this.getStartPosition(), end, this.getEndPosition(), end > this.getEndPosition())
		return this.file.slice(start, end);
	}
	setTimeout(function() {
		self.clip(start);
		self.check(end);
	}, 100);
	var slice = this.cachedChunk.slice(this.normalizePosition(start), this.normalizePosition(end));
	return slice;
};