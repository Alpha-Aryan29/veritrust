// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TrustRegistry
/// @notice Shared trust registry for institutions that issue verifiable records.
/// @dev Only hashes and identities live on-chain. Personal data and full record
///      contents never touch the chain; verifiers recompute the hash off-chain.
contract TrustRegistry {
    // ------------------------------------------------------------------ errors
    error NotOwner();
    error NotInstitutionAdmin();
    error NotAuthorizedIssuer();
    error NotRecordAuthority();
    error InstitutionExists();
    error InstitutionUnknown();
    error InstitutionInactive();
    error IssuerAlreadyAuthorized();
    error IssuerNotAuthorized();
    error RecordExists();
    error RecordUnknown();
    error AlreadyRevoked();
    error ZeroAddress();
    error EmptyBatch();

    // ------------------------------------------------------------------ types
    struct Institution {
        string name;
        address admin;       // manages this institution's issuer keys
        bool active;         // false = suspended by the registry owner
        bool exists;
        uint64 registeredAt;
    }

    struct Record {
        bytes32 institutionId;
        address issuer;      // key that anchored the record
        uint64 issuedAt;     // 0 = record unknown
        uint64 revokedAt;    // 0 = not revoked
        address revokedBy;
        uint8 reason;        // 0 unspecified, 1 issued in error, 2 fraud, 3 withdrawn, 4 superseded
    }

    // ------------------------------------------------------------------ state
    address public owner;                                  // consortium registrar
    bytes32[] private _institutionIds;
    mapping(bytes32 => Institution) private _institutions;
    mapping(address => bytes32) public issuerInstitution;  // issuer key -> institution (0 = none)
    mapping(bytes32 => Record) private _records;

    uint256 public recordCount;
    uint256 public revocationCount;

    // ----------------------------------------------------------------- events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event InstitutionRegistered(bytes32 indexed institutionId, string name, address indexed admin);
    event InstitutionStatusChanged(bytes32 indexed institutionId, bool active);
    event IssuerAuthorized(bytes32 indexed institutionId, address indexed issuer);
    event IssuerRemoved(bytes32 indexed institutionId, address indexed issuer);
    event RecordIssued(bytes32 indexed recordHash, bytes32 indexed institutionId, address indexed issuer);
    event RecordRevoked(bytes32 indexed recordHash, bytes32 indexed institutionId, address indexed by, uint8 reason);

    // -------------------------------------------------------------- modifiers
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyInstitutionAdmin(bytes32 id) {
        Institution storage inst = _institutions[id];
        if (!inst.exists) revert InstitutionUnknown();
        if (msg.sender != inst.admin) revert NotInstitutionAdmin();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ------------------------------------------------- registry governance
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Registrar admits an institution to the trust network.
    function registerInstitution(bytes32 id, string calldata name, address admin) external onlyOwner {
        if (admin == address(0)) revert ZeroAddress();
        if (_institutions[id].exists) revert InstitutionExists();
        _institutions[id] = Institution({
            name: name,
            admin: admin,
            active: true,
            exists: true,
            registeredAt: uint64(block.timestamp)
        });
        _institutionIds.push(id);
        emit InstitutionRegistered(id, name, admin);
    }

    /// @notice Registrar suspends or reinstates an institution.
    function setInstitutionActive(bytes32 id, bool active) external onlyOwner {
        Institution storage inst = _institutions[id];
        if (!inst.exists) revert InstitutionUnknown();
        inst.active = active;
        emit InstitutionStatusChanged(id, active);
    }

    // ------------------------------------------------ institution management
    function addIssuer(bytes32 id, address issuer) external onlyInstitutionAdmin(id) {
        if (issuer == address(0)) revert ZeroAddress();
        if (issuerInstitution[issuer] != bytes32(0)) revert IssuerAlreadyAuthorized();
        issuerInstitution[issuer] = id;
        emit IssuerAuthorized(id, issuer);
    }

    function removeIssuer(address issuer) external {
        bytes32 id = issuerInstitution[issuer];
        if (id == bytes32(0)) revert IssuerNotAuthorized();
        if (msg.sender != _institutions[id].admin) revert NotInstitutionAdmin();
        delete issuerInstitution[issuer];
        emit IssuerRemoved(id, issuer);
    }

    // ----------------------------------------------------- issuance / revoke
    /// @notice Anchor the hash of a signed record. Only an authorized issuer of an active institution.
    function issueRecord(bytes32 recordHash) external {
        _issue(recordHash, msg.sender);
    }

    function issueBatch(bytes32[] calldata hashes) external {
        if (hashes.length == 0) revert EmptyBatch();
        for (uint256 i = 0; i < hashes.length; i++) {
            _issue(hashes[i], msg.sender);
        }
    }

    function _issue(bytes32 recordHash, address issuer) private {
        bytes32 id = issuerInstitution[issuer];
        if (id == bytes32(0)) revert NotAuthorizedIssuer();
        if (!_institutions[id].active) revert InstitutionInactive();
        if (_records[recordHash].issuedAt != 0) revert RecordExists();

        _records[recordHash] = Record({
            institutionId: id,
            issuer: issuer,
            issuedAt: uint64(block.timestamp),
            revokedAt: 0,
            revokedBy: address(0),
            reason: 0
        });
        recordCount += 1;
        emit RecordIssued(recordHash, id, issuer);
    }

    /// @notice Revoke a record. Only an active issuer or the admin of the issuing institution.
    function revokeRecord(bytes32 recordHash, uint8 reason) external {
        Record storage r = _records[recordHash];
        if (r.issuedAt == 0) revert RecordUnknown();
        if (r.revokedAt != 0) revert AlreadyRevoked();

        bool isIssuer = issuerInstitution[msg.sender] == r.institutionId;
        bool isAdmin = msg.sender == _institutions[r.institutionId].admin;
        if (!isIssuer && !isAdmin) revert NotRecordAuthority();

        r.revokedAt = uint64(block.timestamp);
        r.revokedBy = msg.sender;
        r.reason = reason;
        revocationCount += 1;
        emit RecordRevoked(recordHash, r.institutionId, msg.sender, reason);
    }

    // ------------------------------------------------------------------ views
    function getRecord(bytes32 recordHash)
        external
        view
        returns (
            bool exists,
            bytes32 institutionId,
            address issuer,
            uint64 issuedAt,
            bool revoked,
            uint64 revokedAt,
            address revokedBy,
            uint8 reason
        )
    {
        Record storage r = _records[recordHash];
        return (r.issuedAt != 0, r.institutionId, r.issuer, r.issuedAt, r.revokedAt != 0, r.revokedAt, r.revokedBy, r.reason);
    }

    function getInstitution(bytes32 id)
        external
        view
        returns (bool exists, string memory name, address admin, bool active, uint64 registeredAt)
    {
        Institution storage inst = _institutions[id];
        return (inst.exists, inst.name, inst.admin, inst.active, inst.registeredAt);
    }

    /// @notice Is this key currently authorized, and for which institution?
    function isAuthorizedIssuer(address issuer) external view returns (bool authorized, bytes32 institutionId) {
        institutionId = issuerInstitution[issuer];
        authorized = institutionId != bytes32(0) && _institutions[institutionId].active;
    }

    function institutionCount() external view returns (uint256) {
        return _institutionIds.length;
    }

    function institutionIdAt(uint256 index) external view returns (bytes32) {
        return _institutionIds[index];
    }
}
