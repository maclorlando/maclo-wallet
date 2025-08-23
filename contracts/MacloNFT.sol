// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MacloNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIds;
    
    // Base URI for token metadata
    string private _baseTokenURI;
    
    // Maximum supply (optional - set to 0 for unlimited)
    uint256 public maxSupply;
    
    // Mint price (0 for free minting)
    uint256 public mintPrice;
    
    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory baseTokenURI,
        uint256 _maxSupply,
        uint256 _mintPrice
    ) ERC721(name, symbol) Ownable(msg.sender) {
        _baseTokenURI = baseTokenURI;
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
    }
    
    function mint(address to, string memory tokenURI) public payable returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(maxSupply == 0 || _tokenIds.current() < maxSupply, "Max supply reached");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        emit NFTMinted(to, newTokenId, tokenURI);
        
        return newTokenId;
    }
    
    function mintBatch(address to, string[] memory tokenURIs) public payable returns (uint256[] memory) {
        require(msg.value >= mintPrice * tokenURIs.length, "Insufficient payment");
        require(maxSupply == 0 || _tokenIds.current() + tokenURIs.length <= maxSupply, "Max supply would be exceeded");
        
        uint256[] memory tokenIds = new uint256[](tokenURIs.length);
        
        for (uint256 i = 0; i < tokenURIs.length; i++) {
            _tokenIds.increment();
            uint256 newTokenId = _tokenIds.current();
            
            _safeMint(to, newTokenId);
            _setTokenURI(newTokenId, tokenURIs[i]);
            
            tokenIds[i] = newTokenId;
            emit NFTMinted(to, newTokenId, tokenURIs[i]);
        }
        
        return tokenIds;
    }
    
    // Admin functions
    function setBaseTokenURI(string memory newBaseTokenURI) public onlyOwner {
        _baseTokenURI = newBaseTokenURI;
    }
    
    function setMintPrice(uint256 newMintPrice) public onlyOwner {
        mintPrice = newMintPrice;
    }
    
    function setMaxSupply(uint256 newMaxSupply) public onlyOwner {
        require(newMaxSupply >= _tokenIds.current(), "New max supply must be >= current supply");
        maxSupply = newMaxSupply;
    }
    
    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // View functions
    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }
    
    function getTokenURI(uint256 tokenId) public view returns (string memory) {
        return tokenURI(tokenId);
    }
    
    // Override functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
}
